const CalendarEvent = require("../models/CalendarEvent");
const asyncHandler = require("../utils/asyncHandler");
const sendResponse = require("../utils/apiResponse");
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

module.exports = {
  getEventsByProperty,
  getEventsByRoom,
  checkRoomAvailability
};
