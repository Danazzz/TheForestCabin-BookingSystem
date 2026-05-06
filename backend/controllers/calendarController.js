const CalendarEvent = require("../models/CalendarEvent");
const Booking = require("../models/Booking");
const Room = require("../models/Room");
const asyncHandler = require("../utils/asyncHandler");
const sendResponse = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const { requireFields, parseDate } = require("../utils/validators");
const { checkAvailability } = require("../services/calendarService");

const applyDateWindow = (query, { startDate, endDate }) => {
  if (startDate && endDate) {
    query.startDate = { $lt: parseDate(endDate, "endDate") };
    query.endDate = { $gt: parseDate(startDate, "startDate") };
  }

  return query;
};

const getEventsByProperty = asyncHandler(async (req, res) => {
  const query = applyDateWindow(
    { propertyId: req.params.propertyId },
    {
      startDate: req.query.startDate,
      endDate: req.query.endDate
    }
  );

  const events = await CalendarEvent.find(query)
    .populate("bookingId")
    .sort({ startDate: 1 });

  sendResponse(res, 200, "Calendar events retrieved successfully", events);
});

const getEventsByRoom = asyncHandler(async (req, res) => {
  const query = applyDateWindow(
    { roomId: req.params.roomId },
    {
      startDate: req.query.startDate,
      endDate: req.query.endDate
    }
  );

  const events = await CalendarEvent.find(query)
    .populate("bookingId")
    .sort({ startDate: 1 });

  sendResponse(res, 200, "Calendar events retrieved successfully", events);
});

const checkRoomAvailability = asyncHandler(async (req, res) => {
  requireFields(req.body, ["roomId", "checkIn", "checkOut"]);

  const result = await checkAvailability({
    roomId: req.body.roomId,
    checkIn: req.body.checkIn,
    checkOut: req.body.checkOut,
    excludeBookingId: req.body.excludeBookingId
  });

  sendResponse(
    res,
    200,
    result.available
      ? "Room is available for the selected dates"
      : "Room is not available for the selected dates",
    result
  );
});

const toDateOnly = (value) => {
  const date = new Date(value);

  return date.toISOString().slice(0, 10);
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);

  return next;
};

const buildDateList = (startDate, endDate) => {
  const dates = [];
  let cursor = new Date(startDate);

  while (cursor <= endDate) {
    dates.push(toDateOnly(cursor));
    cursor = addDays(cursor, 1);
  }

  return dates;
};

const statusOrder = [
  "success",
  "waiting_admin_approval",
  "pending_payment",
  "waiting_availability_approval",
  "rejected",
  "cancelled"
];

const getAdminCalendarEvents = asyncHandler(async (req, res) => {
  const query = {};

  if (req.query.startDate && req.query.endDate) {
    const startDate = parseDate(req.query.startDate, "startDate");
    const endDate = parseDate(req.query.endDate, "endDate");
    query.startDate = { $lt: addDays(endDate, 1) };
    query.endDate = { $gt: startDate };
  }

  if (req.query.roomType && req.query.roomType !== "all") {
    query.roomType = Room.normalizeRoomType(req.query.roomType);
  }

  const events = await CalendarEvent.find(query)
    .populate("bookingId")
    .populate("roomId")
    .sort({ startDate: 1 });

  sendResponse(res, 200, "Admin calendar events retrieved successfully", events);
});

const getCalendarGrid = asyncHandler(async (req, res) => {
  requireFields(req.query, ["startDate", "endDate"]);

  const startDate = parseDate(req.query.startDate, "startDate");
  const endDate = parseDate(req.query.endDate, "endDate");

  if (startDate > endDate) {
    throw new AppError("endDate must be the same as or later than startDate", 400);
  }

  const roomType = req.query.roomType || "all";
  const normalizedRoomType = roomType === "all" ? "all" : Room.normalizeRoomType(roomType);

  const roomQuery = normalizedRoomType === "all" ? {} : { roomType: normalizedRoomType };
  const rooms = await Room.find(roomQuery).sort({ roomType: 1, roomNumber: 1 });
  const roomIds = rooms.map((room) => room._id);

  const bookings = await Booking.find({
    roomId: { $in: roomIds },
    bookingStatus: { $in: statusOrder },
    checkIn: { $lt: addDays(endDate, 1) },
    checkOut: { $gt: startDate }
  })
    .populate("roomId")
    .sort({ checkIn: 1, createdAt: 1 });

  const bookingsByRoom = new Map();

  bookings.forEach((booking) => {
    const key = String(booking.roomId?._id || booking.roomId);

    if (!bookingsByRoom.has(key)) {
      bookingsByRoom.set(key, []);
    }

    bookingsByRoom.get(key).push({
      bookingId: booking._id,
      bookingCode: booking.bookingCode,
      guestName: booking.guestName,
      roomNumber: booking.roomId?.roomNumber,
      roomType: booking.roomType,
      checkIn: toDateOnly(booking.checkIn),
      checkOut: toDateOnly(booking.checkOut),
      status: booking.bookingStatus,
      paymentStatus: booking.paymentStatus,
      startDate: toDateOnly(booking.checkIn),
      endDate: toDateOnly(booking.checkOut)
    });
  });

  const roomTypeOrder = [...new Set(rooms.map((room) => room.roomType))].sort();
  const roomGroups = roomTypeOrder
    .map((currentRoomType) => ({
      roomType: currentRoomType,
      rooms: rooms
        .filter((room) => room.roomType === currentRoomType)
        .map((room) => ({
          roomId: room._id,
          roomNumber: room.roomNumber,
          roomType: room.roomType,
          name: room.name,
          status: room.status,
          bookings: bookingsByRoom.get(String(room._id)) || []
        }))
    }))
    .filter((group) => group.rooms.length > 0);

  sendResponse(res, 200, "Calendar grid retrieved successfully", {
    dates: buildDateList(startDate, endDate),
    roomGroups
  });
});

module.exports = {
  getEventsByProperty,
  getEventsByRoom,
  checkRoomAvailability,
  getAdminCalendarEvents,
  getCalendarGrid
};
