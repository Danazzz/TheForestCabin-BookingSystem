const Booking = require("../models/Booking");
const Room = require("../models/Room");
const AppError = require("../utils/AppError");
const runWithOptionalTransaction = require("../utils/runWithOptionalTransaction");
const {
  assertRoomAvailable,
  assertRoomExistsAndActive,
  findAvailableRoomsByType
} = require("./availabilityService");
const {
  buildRoomSnapshot,
  getRoomItemsFromBooking,
  hydrateAssignedRoomSnapshots,
  saveBookingRoomAssignments
} = require("./bookingRoomItemsService");
const {
  sendAvailabilityApprovedEmail,
  sendNoRoomAvailableEmail
} = require("./emailService");

const sessionOption = (session) => (session ? { session } : undefined);
const DEFAULT_PAYMENT_DEADLINE_HOURS = 24;

const getPaymentDeadline = () => {
  const configuredHours = Number(
    process.env.PAYMENT_DEADLINE_HOURS || DEFAULT_PAYMENT_DEADLINE_HOURS
  );
  const hours = Number.isFinite(configuredHours) && configuredHours > 0
    ? configuredHours
    : DEFAULT_PAYMENT_DEADLINE_HOURS;

  return new Date(Date.now() + hours * 60 * 60 * 1000);
};

const getAvailabilityReviewPayload = async (bookingId, { session } = {}) => {
  const booking = await Booking.findById(bookingId)
    .populate("calendarEventId")
    .populate("calendarEventIds")
    .populate("invoiceId")
    .populate("paymentId")
    .populate("roomId")
    .session(session || null);

  return { booking };
};

const assertReviewableBooking = (booking) => {
  if (!booking) {
    throw new AppError("Booking not found", 404);
  }

  if (["success", "cancelled", "rejected"].includes(booking.bookingStatus)) {
    throw new AppError("This booking can no longer be reviewed for availability", 409);
  }

  if (booking.bookingStatus !== "waiting_availability_approval") {
    throw new AppError("Only bookings waiting for availability approval can be reviewed", 409);
  }
};

const validateRoomCapacity = (booking, room) => {
  if (booking.numberOfGuests > room.capacity) {
    throw new AppError(
      `${room.name} ${room.roomNumber} can host up to ${room.capacity} adult guests`,
      400
    );
  }

  if ((booking.numberOfChildren || 0) > (room.childCapacity || 0)) {
    throw new AppError(
      `${room.name} ${room.roomNumber} can host up to ${room.childCapacity || 0} children`,
      400
    );
  }
};

const validateRoomItemCapacity = (item, rooms) => {
  const adultCapacity = rooms.reduce((total, room) => total + (room.capacity || 0), 0);
  const childCapacity = rooms.reduce((total, room) => total + (room.childCapacity || 0), 0);

  if ((item.adultGuests || 0) > adultCapacity) {
    throw new AppError(
      `Selected ${item.roomType} room(s) can host up to ${adultCapacity} adult guests`,
      400
    );
  }

  if ((item.childGuests || 0) > childCapacity) {
    throw new AppError(
      `Selected ${item.roomType} room(s) can host up to ${childCapacity} children`,
      400
    );
  }
};

const selectAvailableRoom = async (booking, roomId, { session } = {}) => {
  if (roomId) {
    const room = await assertRoomExistsAndActive(roomId, { session });

    if (room.roomType !== Room.normalizeRoomType(booking.roomType)) {
      throw new AppError("Selected room does not match booking room type", 400);
    }

    validateRoomCapacity(booking, room);
    await assertRoomAvailable(
      {
        roomId: room._id,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        excludeBookingId: booking._id
      },
      {
        session,
        message: "Cannot approve booking because the room is no longer available."
      }
    );

    return room;
  }

  const room = await findAvailableRoomByType({
    roomType: booking.roomType,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut
  });

  validateRoomCapacity(booking, room);

  return room;
};

const assignRoomsForBooking = async (booking, { roomId, roomItems: requestedAssignments } = {}, { session } = {}) => {
  const roomItems = getRoomItemsFromBooking(booking).map((item) => ({
    roomType: Room.normalizeRoomType(item.roomType),
    roomCount: item.roomCount || 1,
    adultGuests: item.adultGuests || booking.numberOfGuests || 0,
    childGuests: item.childGuests || booking.numberOfChildren || 0,
    basePrice: item.basePrice || 0,
    nights: item.nights || 0,
    subtotal: item.subtotal || 0,
    assignedRooms: []
  }));
  const assignedRoomIds = new Set();

  for (let index = 0; index < roomItems.length; index += 1) {
    const item = roomItems[index];
    const explicitAssignment = Array.isArray(requestedAssignments)
      ? requestedAssignments[index]
      : null;
    const explicitRoomIds = explicitAssignment?.assignedRoomIds || explicitAssignment?.roomIds || [];

    if (roomId && index === 0 && explicitRoomIds.length === 0 && item.roomCount === 1) {
      const room = await selectAvailableRoom(booking, roomId, { session });
      item.assignedRooms = [buildRoomSnapshot(room)];
      assignedRoomIds.add(String(room._id));
      continue;
    }

    if (explicitRoomIds.length > 0) {
      if (explicitRoomIds.length !== item.roomCount) {
        throw new AppError(`Select exactly ${item.roomCount} room(s) for ${item.roomType}`, 400);
      }

      const snapshots = await hydrateAssignedRoomSnapshots(explicitRoomIds, { session });
      const rooms = await Room.find({ _id: { $in: explicitRoomIds }, status: "active" })
        .session(session || null);

      rooms.forEach((room) => {
        if (room.roomType !== item.roomType) {
          throw new AppError("Selected room does not match booking room type", 400);
        }
      });

      validateRoomItemCapacity(item, rooms);

      for (const room of rooms) {
        if (assignedRoomIds.has(String(room._id))) {
          throw new AppError("The same room cannot be assigned twice to one booking", 400);
        }

        await assertRoomAvailable(
          {
            roomId: room._id,
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            excludeBookingId: booking._id
          },
          {
            session,
            message: "Cannot approve booking because the room is no longer available."
          }
        );
        assignedRoomIds.add(String(room._id));
      }

      item.assignedRooms = snapshots;
      continue;
    }

    const rooms = await findAvailableRoomsByType(
      {
        roomType: item.roomType,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        count: item.roomCount,
        excludeRoomIds: [...assignedRoomIds]
      },
      { session }
    );

    validateRoomItemCapacity(item, rooms);
    item.assignedRooms = rooms.map(buildRoomSnapshot);
    rooms.forEach((room) => assignedRoomIds.add(String(room._id)));
  }

  return roomItems;
};

const approveAvailability = async (bookingId, { roomId, roomItems, adminNote, approvedBy } = {}) => {
  const result = await runWithOptionalTransaction(async (session) => {
    const booking = await Booking.findById(bookingId).session(session || null);
    assertReviewableBooking(booking);

    const assignedRoomItems = await assignRoomsForBooking(
      booking,
      { roomId: roomId || booking.roomId, roomItems },
      { session }
    );

    await saveBookingRoomAssignments(booking, assignedRoomItems, { session });
    booking.bookingStatus = "pending_payment";
    booking.paymentStatus = "unpaid";
    booking.paymentDueAt = getPaymentDeadline();
    booking.availabilityApprovedAt = new Date();
    booking.availabilityApprovedBy = approvedBy || "system-admin";
    booking.rejectionReason = null;
    booking.rejectedAt = null;
    booking.rejectedBy = null;
    booking.adminNote = adminNote || booking.adminNote || null;
    await booking.save(sessionOption(session));

    return getAvailabilityReviewPayload(booking._id, { session });
  });

  await sendAvailabilityApprovedEmail(result.booking._id).catch(() => null);

  return getAvailabilityReviewPayload(result.booking._id);
};

const rejectAvailability = async (
  bookingId,
  { rejectionReason = "no_room_available", adminNote, rejectedBy } = {}
) => {
  if (!Booking.rejectionReasons.includes(rejectionReason)) {
    throw new AppError(
      `rejectionReason must be one of: ${Booking.rejectionReasons.join(", ")}`,
      400
    );
  }

  const result = await runWithOptionalTransaction(async (session) => {
    const booking = await Booking.findById(bookingId).session(session || null);
    assertReviewableBooking(booking);

    booking.bookingStatus = "rejected";
    booking.paymentStatus = "unpaid";
    booking.paymentDueAt = null;
    booking.rejectionReason = rejectionReason;
    booking.adminNote = adminNote || rejectionReason;
    booking.rejectedAt = new Date();
    booking.rejectedBy = rejectedBy || "system-admin";
    await booking.save(sessionOption(session));

    return getAvailabilityReviewPayload(booking._id, { session });
  });

  await sendNoRoomAvailableEmail(result.booking._id).catch(() => null);

  return getAvailabilityReviewPayload(result.booking._id);
};

module.exports = {
  approveAvailability,
  rejectAvailability,
  getAvailabilityReviewPayload
};
