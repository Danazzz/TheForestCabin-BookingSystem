const Booking = require("../models/Booking");
const CalendarEvent = require("../models/CalendarEvent");
const Room = require("../models/Room");
const AppError = require("../utils/AppError");
const { validateDateRange, parseDate } = require("../utils/validators");
const {
  assertRoomAvailable,
  checkRoomAvailability
} = require("./availabilityService");

const sessionOption = (session) => (session ? { session } : undefined);

const assertAvailability = async (
  { roomId, checkIn, checkOut, excludeBookingId },
  { session, message } = {}
) => {
  return assertRoomAvailable(
    { roomId, checkIn, checkOut, excludeBookingId },
    { session, message }
  );
};

const checkAvailability = async ({ roomId, checkIn, checkOut, excludeBookingId }) => {
  return checkRoomAvailability({ roomId, checkIn, checkOut, excludeBookingId });
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

  const room = await Room.findById(booking.roomId).session(session || null);

  if (!room) {
    throw new AppError("Room not found for this booking", 404);
  }

  const [calendarEvent] = await CalendarEvent.create(
    [
      {
        bookingId: booking._id,
        propertyId: booking.propertyId,
        roomId: booking.roomId,
        roomNumber: room.roomNumber,
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
