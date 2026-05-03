const Booking = require("../models/Booking");
const CalendarEvent = require("../models/CalendarEvent");
const AppError = require("../utils/AppError");
const { validateDateRange, parseDate } = require("../utils/validators");

const sessionOption = (session) => (session ? { session } : undefined);

const buildOverlapQuery = ({ roomId, startDate, endDate, excludeBookingId }) => {
  const query = {
    roomId,
    status: "confirmed",
    startDate: { $lt: endDate },
    endDate: { $gt: startDate }
  };

  if (excludeBookingId) {
    query.bookingId = { $ne: excludeBookingId };
  }

  return query;
};

const getConflictingEvents = async (
  { roomId, checkIn, checkOut, excludeBookingId },
  { session } = {}
) => {
  const { startDate, endDate } = validateDateRange(checkIn, checkOut);

  return CalendarEvent.find(
    buildOverlapQuery({ roomId, startDate, endDate, excludeBookingId })
  )
    .sort({ startDate: 1 })
    .session(session || null);
};

const assertAvailability = async (
  { roomId, checkIn, checkOut, excludeBookingId },
  { session, message } = {}
) => {
  const conflicts = await getConflictingEvents(
    { roomId, checkIn, checkOut, excludeBookingId },
    { session }
  );

  if (conflicts.length > 0) {
    throw new AppError(
      message ||
        "Room is not available for the selected dates because it overlaps with an existing confirmed booking",
      409,
      conflicts.map((event) => ({
        calendarEventId: event._id,
        bookingId: event.bookingId,
        roomId: event.roomId,
        startDate: event.startDate,
        endDate: event.endDate,
        guestName: event.guestName
      }))
    );
  }

  return true;
};

const checkAvailability = async ({ roomId, checkIn, checkOut, excludeBookingId }) => {
  const conflicts = await getConflictingEvents({
    roomId,
    checkIn,
    checkOut,
    excludeBookingId
  });

  return {
    available: conflicts.length === 0,
    conflicts
  };
};

const createCalendarEventForBooking = async (
  booking,
  { session, availabilityMessage } = {}
) => {
  const existingEvent = await CalendarEvent.findOne({
    bookingId: booking._id,
    status: "confirmed"
  }).session(session || null);

  if (existingEvent) {
    return existingEvent;
  }

  await assertAvailability(
    {
      roomId: booking.roomId,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      excludeBookingId: booking._id
    },
    {
      session,
      message: availabilityMessage
    }
  );

  const [calendarEvent] = await CalendarEvent.create(
    [
      {
        bookingId: booking._id,
        propertyId: booking.propertyId,
        roomId: booking.roomId,
        roomType: booking.roomType,
        title: `Booking - ${booking.guestName}`,
        startDate: parseDate(booking.checkIn, "checkIn"),
        endDate: parseDate(booking.checkOut, "checkOut"),
        guestName: booking.guestName,
        status: "confirmed",
        source: booking.source
      }
    ],
    sessionOption(session)
  );

  return calendarEvent;
};

const cancelCalendarEvent = async (calendarEventId, { session } = {}) => {
  if (!calendarEventId) {
    return null;
  }

  return CalendarEvent.findByIdAndUpdate(
    calendarEventId,
    { status: "cancelled" },
    { new: true, ...sessionOption(session) }
  );
};

const cancelCalendarEventByBooking = async (bookingId, { session } = {}) => {
  return CalendarEvent.findOneAndUpdate(
    { bookingId, status: "confirmed" },
    { status: "cancelled" },
    { new: true, ...sessionOption(session) }
  );
};

const cancelBookingCalendarEvent = async (bookingId, { session } = {}) => {
  const booking = await Booking.findById(bookingId).session(session || null);

  if (!booking) {
    throw new AppError("Booking not found", 404);
  }

  if (booking.calendarEventId) {
    return cancelCalendarEvent(booking.calendarEventId, { session });
  }

  return cancelCalendarEventByBooking(booking._id, { session });
};

module.exports = {
  assertAvailability,
  checkAvailability,
  createCalendarEventForBooking,
  cancelCalendarEvent,
  cancelCalendarEventByBooking,
  cancelBookingCalendarEvent
};
