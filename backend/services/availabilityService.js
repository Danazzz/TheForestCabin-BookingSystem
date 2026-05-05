const Booking = require("../models/Booking");
const Room = require("../models/Room");
const AppError = require("../utils/AppError");
const { validateDateRange } = require("../utils/validators");

const sessionOption = (session) => (session ? { session } : {});

const getSuccessfulOverlapQuery = ({
  roomId,
  checkIn,
  checkOut,
  excludeBookingId
}) => {
  const query = {
    roomId,
    bookingStatus: "success",
    checkIn: { $lt: checkOut },
    checkOut: { $gt: checkIn }
  };

  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }

  return query;
};

const getConflictingSuccessfulBookings = async (
  { roomId, checkIn, checkOut, excludeBookingId },
  { session } = {}
) => {
  const { startDate, endDate } = validateDateRange(checkIn, checkOut);

  return Booking.find(
    getSuccessfulOverlapQuery({
      roomId,
      checkIn: startDate,
      checkOut: endDate,
      excludeBookingId
    })
  )
    .populate("roomId")
    .sort({ checkIn: 1 })
    .session(session || null);
};

const checkRoomAvailability = async (
  { roomId, checkIn, checkOut, excludeBookingId },
  { session } = {}
) => {
  const conflicts = await getConflictingSuccessfulBookings(
    { roomId, checkIn, checkOut, excludeBookingId },
    { session }
  );

  return {
    available: conflicts.length === 0,
    conflicts
  };
};

const assertRoomAvailable = async (
  { roomId, checkIn, checkOut, excludeBookingId },
  { session, message } = {}
) => {
  const result = await checkRoomAvailability(
    { roomId, checkIn, checkOut, excludeBookingId },
    { session }
  );

  if (!result.available) {
    throw new AppError(
      message ||
        "Room is not available for the selected dates because it overlaps with an existing successful booking",
      409,
      result.conflicts.map((booking) => ({
        bookingId: booking._id,
        bookingCode: booking.bookingCode,
        roomId: booking.roomId?._id || booking.roomId,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        guestName: booking.guestName
      }))
    );
  }

  return true;
};

const getRoomsByType = async ({ roomType, includeInactive = false } = {}) => {
  const query = {};

  if (roomType && roomType !== "all") {
    query.roomType = roomType;
  }

  if (!includeInactive) {
    query.status = "active";
  }

  return Room.find(query).sort({ roomType: 1, roomNumber: 1 });
};

const getAvailabilityByRoomType = async ({ roomType, checkIn, checkOut }) => {
  const { startDate, endDate } = validateDateRange(checkIn, checkOut);
  const rooms = await getRoomsByType({ roomType });
  const roomIds = rooms.map((room) => room._id);

  const blockingBookings = await Booking.find({
    roomId: { $in: roomIds },
    bookingStatus: "success",
    checkIn: { $lt: endDate },
    checkOut: { $gt: startDate }
  }).select("roomId bookingCode guestName checkIn checkOut bookingStatus");

  const blockedRoomIds = new Set(
    blockingBookings.map((booking) => String(booking.roomId))
  );

  const availableRooms = rooms.filter((room) => !blockedRoomIds.has(String(room._id)));
  const unavailableRooms = rooms.filter((room) => blockedRoomIds.has(String(room._id)));

  return {
    roomType,
    checkIn: startDate,
    checkOut: endDate,
    totalRooms: rooms.length,
    availableCount: availableRooms.length,
    unavailableCount: unavailableRooms.length,
    available: availableRooms.length > 0,
    availableRooms,
    unavailableRooms,
    blockingBookings
  };
};

const findAvailableRoomByType = async ({ roomType, checkIn, checkOut }) => {
  const availability = await getAvailabilityByRoomType({ roomType, checkIn, checkOut });

  if (!availability.available) {
    throw new AppError("No room is available for the selected room type and dates", 409, {
      roomType,
      checkIn,
      checkOut
    });
  }

  return availability.availableRooms[0];
};

const assertRoomExistsAndActive = async (roomId, { session } = {}) => {
  const room = await Room.findOne({ _id: roomId, status: "active" }).session(session || null);

  if (!room) {
    throw new AppError("Room not found or inactive", 404);
  }

  return room;
};

module.exports = {
  getSuccessfulOverlapQuery,
  getConflictingSuccessfulBookings,
  checkRoomAvailability,
  assertRoomAvailable,
  getRoomsByType,
  getAvailabilityByRoomType,
  findAvailableRoomByType,
  assertRoomExistsAndActive,
  sessionOption
};
