const Booking = require("../models/Booking");
const CalendarEvent = require("../models/CalendarEvent");
const Room = require("../models/Room");
const AppError = require("../utils/AppError");
const { validateDateRange, parseDate } = require("../utils/validators");
const {
  assertRoomAvailable,
  checkRoomAvailability
} = require("./availabilityService");
const { getAssignedRoomsFromBooking } = require("./bookingRoomItemsService");

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
  const existingEvents = await CalendarEvent.find({
    bookingId: booking._id,
    status: "confirmed"
  }).session(session || null);
  const assignedRooms = getAssignedRoomsFromBooking(booking);

  if (existingEvents.length >= assignedRooms.length && existingEvents.length > 0) {
    existingEvents[0].calendarEventIds = existingEvents.map((event) => event._id);
    return existingEvents[0];
  }

  if (assignedRooms.length === 0) {
    throw new AppError("Room not found for this booking", 404);
  }

  const existingRoomIds = new Set(
    existingEvents.map((event) => String(event.roomId?._id || event.roomId))
  );
  const createdEvents = [...existingEvents];

  for (const assignedRoom of assignedRooms) {
    if (existingRoomIds.has(String(assignedRoom.roomId))) {
      continue;
    }

    await assertAvailability(
      {
        roomId: assignedRoom.roomId,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        excludeBookingId: booking._id
      },
      {
        session,
        message: availabilityMessage
      }
    );

    const room = await Room.findById(assignedRoom.roomId).session(session || null);

    if (!room) {
      throw new AppError("Room not found for this booking", 404);
    }

    const [calendarEvent] = await CalendarEvent.create(
      [
        {
          bookingId: booking._id,
          propertyId: booking.propertyId,
          roomId: assignedRoom.roomId,
          roomNumber: assignedRoom.roomNumber || room.roomNumber,
          roomType: assignedRoom.roomType || room.roomType,
          title: `Booking - ${booking.guestName}`,
          startDate: parseDate(booking.checkIn, "checkIn"),
          endDate: parseDate(booking.checkOut, "checkOut"),
          guestName: booking.guestName,
          status: "confirmed",
          source: booking.source,
          sourceName: booking.sourceName || ""
        }
      ],
      sessionOption(session)
    );

    createdEvents.push(calendarEvent);
  }

  const firstEvent = createdEvents[0];
  firstEvent.calendarEventIds = createdEvents.map((event) => event._id);

  return firstEvent;
};

const createLegacyCalendarEventForBooking = async (
  booking,
  { session, availabilityMessage } = {}
) => {
  const existingEvent = await CalendarEvent.findOne({
    bookingId: booking._id,
    status: "confirmed"
  }).session(session || null);

  if (existingEvent) {
    existingEvent.calendarEventIds = [existingEvent._id];
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
        source: booking.source,
        sourceName: booking.sourceName || ""
      }
    ],
    sessionOption(session)
  );

  calendarEvent.calendarEventIds = [calendarEvent._id];

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
  return CalendarEvent.updateMany(
    { bookingId, status: "confirmed" },
    { status: "cancelled" },
    sessionOption(session) || {}
  );
};

const cancelBookingCalendarEvent = async (bookingId, { session } = {}) => {
  const booking = await Booking.findById(bookingId).session(session || null);

  if (!booking) {
    throw new AppError("Booking not found", 404);
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
