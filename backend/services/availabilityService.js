const Booking = require("../models/Booking");
const Room = require("../models/Room");
const AppError = require("../utils/AppError");
const { parseDate, validateDateRange } = require("../utils/validators");
const { getAssignedRoomsFromBooking } = require("./bookingRoomItemsService");

const sessionOption = (session) => (session ? { session } : {});

const getSuccessfulOverlapQuery = ({
  roomId,
  checkIn,
  checkOut,
  excludeBookingId
}) => {
  const query = {
    bookingStatus: "success",
    checkIn: { $lt: checkOut },
    checkOut: { $gt: checkIn },
    $or: [
      { roomId },
      { "roomItems.assignedRooms.roomId": roomId }
    ]
  };

  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }

  return query;
};

const getRoomIdsFromBookings = (bookings) => {
  const roomIds = new Set();

  bookings.forEach((booking) => {
    getAssignedRoomsFromBooking(booking).forEach((room) => {
      if (room.roomId) {
        roomIds.add(String(room.roomId?._id || room.roomId));
      }
    });
  });

  return roomIds;
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
    query.roomType = Room.normalizeRoomType(roomType);
  }

  if (!includeInactive) {
    query.status = "active";
  }

  return Room.find(query).sort({ roomType: 1, roomNumber: 1 });
};

const getAvailabilityByRoomType = async ({ roomType, checkIn, checkOut }, { session } = {}) => {
  const { startDate, endDate } = validateDateRange(checkIn, checkOut);
  const rooms = await getRoomsByType({ roomType });
  const roomIds = rooms.map((room) => room._id);

  const blockingBookings = await Booking.find({
    bookingStatus: "success",
    checkIn: { $lt: endDate },
    checkOut: { $gt: startDate },
    $or: [
      { roomId: { $in: roomIds } },
      { "roomItems.assignedRooms.roomId": { $in: roomIds } }
    ]
  })
    .select("roomId roomItems bookingCode guestName checkIn checkOut bookingStatus")
    .session(session || null);

  const blockedRoomIds = getRoomIdsFromBookings(blockingBookings);

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

const findAvailableRoomsByType = async (
  { roomType, checkIn, checkOut, count = 1, excludeRoomIds = [] },
  { session } = {}
) => {
  const normalizedRoomType = Room.normalizeRoomType(roomType);
  const availability = await getAvailabilityByRoomType(
    {
      roomType: normalizedRoomType,
      checkIn,
      checkOut
    },
    { session }
  );
  const excluded = new Set(excludeRoomIds.map(String));
  const availableRooms = availability.availableRooms.filter(
    (room) => !excluded.has(String(room._id))
  );

  if (availableRooms.length < count) {
    throw new AppError("Not enough rooms are available for the selected room type and dates", 409, {
      roomType: normalizedRoomType,
      checkIn,
      checkOut,
      requestedCount: count,
      availableCount: availableRooms.length
    });
  }

  return availableRooms.slice(0, count);
};

const findAvailableRoomByType = async (payload, options = {}) => {
  const rooms = await findAvailableRoomsByType(
    { ...payload, count: 1 },
    options
  );

  return rooms[0];
};

const startOfUtcDay = (value, fieldName) => {
  const date = parseDate(value, fieldName);
  date.setUTCHours(0, 0, 0, 0);

  return date;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);

  return next;
};

const toDateOnly = (date) => date.toISOString().slice(0, 10);

const getAvailabilityCalendarByRoomType = async ({ roomType, startDate, endDate }) => {
  const normalizedRoomType = Room.normalizeRoomType(roomType);

  if (!normalizedRoomType) {
    throw new AppError("roomType is required", 400);
  }

  const calendarStart = startOfUtcDay(startDate, "startDate");
  const calendarEnd = startOfUtcDay(endDate, "endDate");

  if (calendarStart > calendarEnd) {
    throw new AppError("endDate must be the same as or later than startDate", 400);
  }

  const rooms = await getRoomsByType({ roomType: normalizedRoomType });
  const roomIds = rooms.map((room) => room._id);
  const rangeEndExclusive = addDays(calendarEnd, 1);

  const blockingBookings = await Booking.find({
    bookingStatus: "success",
    checkIn: { $lt: rangeEndExclusive },
    checkOut: { $gt: calendarStart },
    $or: [
      { roomId: { $in: roomIds } },
      { "roomItems.assignedRooms.roomId": { $in: roomIds } }
    ]
  }).select("roomId roomItems bookingCode guestName checkIn checkOut bookingStatus");

  const dates = [];
  let cursor = new Date(calendarStart);

  while (cursor <= calendarEnd) {
    const dayStart = new Date(cursor);
    const dayEnd = addDays(dayStart, 1);
    const blockedRoomIds = new Set();

    blockingBookings.forEach((booking) => {
      if (booking.checkIn < dayEnd && booking.checkOut > dayStart) {
        getAssignedRoomsFromBooking(booking).forEach((room) => {
          blockedRoomIds.add(String(room.roomId?._id || room.roomId));
        });
      }
    });

    const bookedCount = blockedRoomIds.size;
    const availableCount = Math.max(rooms.length - bookedCount, 0);

    dates.push({
      date: toDateOnly(dayStart),
      totalRooms: rooms.length,
      bookedCount,
      availableCount,
      isAvailable: availableCount > 0
    });

    cursor = dayEnd;
  }

  return {
    roomType: normalizedRoomType,
    startDate: calendarStart,
    endDate: calendarEnd,
    totalRooms: rooms.length,
    dates
  };
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
  getAvailabilityCalendarByRoomType,
  findAvailableRoomsByType,
  findAvailableRoomByType,
  assertRoomExistsAndActive,
  sessionOption
};
