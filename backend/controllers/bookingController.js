const Booking = require("../models/Booking");
const Invoice = require("../models/Invoice");
const Room = require("../models/Room");
const asyncHandler = require("../utils/asyncHandler");
const sendResponse = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const runWithOptionalTransaction = require("../utils/runWithOptionalTransaction");
const {
  requireFields,
  validateDateRange,
  validateEnum,
  validateObjectId,
  validatePositiveNumber
} = require("../utils/validators");
const { bookingStatuses, paymentStatuses, bookingSources } = require("../models/Booking");
const { cancelBookingCalendarEvent } = require("../services/calendarService");
const {
  assertRoomAvailable,
  assertRoomExistsAndActive,
  findAvailableRoomByType
} = require("../services/availabilityService");

const getNights = (checkIn, checkOut) => {
  const milliseconds = new Date(checkOut).getTime() - new Date(checkIn).getTime();

  return Math.ceil(milliseconds / (1000 * 60 * 60 * 24));
};

const createBooking = asyncHandler(async (req, res) => {
  requireFields(req.body, [
    "guestName",
    "guestEmail",
    "guestPhone",
    "roomType",
    "checkIn",
    "checkOut",
    "numberOfGuests"
  ]);

  const { startDate, endDate } = validateDateRange(req.body.checkIn, req.body.checkOut);
  const numberOfGuests = validatePositiveNumber(req.body.numberOfGuests, "numberOfGuests");
  const numberOfChildren = validatePositiveNumber(
    req.body.numberOfChildren ?? 0,
    "numberOfChildren",
    true
  );
  const totalAmountFromRequest = req.body.totalAmount !== undefined
    ? validatePositiveNumber(req.body.totalAmount, "totalAmount", true)
    : null;
  const source = req.body.source || "direct";
  const requestedRoomType = Room.normalizeRoomType(req.body.roomType);
  validateEnum(source, bookingSources, "source");

  if (!requestedRoomType) {
    throw new AppError("roomType is required", 400);
  }

  let room;

  if (req.body.roomId) {
    validateObjectId(req.body.roomId, "room id");
    room = await assertRoomExistsAndActive(req.body.roomId);

    if (room.roomType !== requestedRoomType) {
      throw new AppError("roomId does not match selected roomType", 400);
    }

    await assertRoomAvailable({
      roomId: room._id,
      checkIn: startDate,
      checkOut: endDate
    });
  } else {
    room = await findAvailableRoomByType({
      roomType: requestedRoomType,
      checkIn: startDate,
      checkOut: endDate
    });
  }

  if (numberOfGuests > room.capacity) {
    throw new AppError(
      `${room.name} ${room.roomNumber} can host up to ${room.capacity} adult guests`,
      400
    );
  }

  if (numberOfChildren > (room.childCapacity || 0)) {
    throw new AppError(
      `${room.name} ${room.roomNumber} can host up to ${room.childCapacity || 0} children`,
      400
    );
  }

  const nights = getNights(startDate, endDate);
  const totalAmount = totalAmountFromRequest ?? room.basePrice * nights;

  const booking = await Booking.create({
    guestName: req.body.guestName,
    guestEmail: req.body.guestEmail,
    guestPhone: req.body.guestPhone,
    propertyId: req.body.propertyId || "the-forest-cabin",
    roomId: room._id,
    roomType: room.roomType,
    checkIn: startDate,
    checkOut: endDate,
    numberOfGuests,
    numberOfChildren,
    totalAmount,
    source,
    bookingStatus: "pending_payment",
    paymentStatus: "unpaid"
  });

  const createdBooking = await Booking.findById(booking._id).populate("roomId");

  sendResponse(res, 201, "Booking created successfully", createdBooking);
});

const getBookings = asyncHandler(async (req, res) => {
  const filters = {};

  if (req.query.bookingStatus) {
    validateEnum(req.query.bookingStatus, bookingStatuses, "bookingStatus");
    filters.bookingStatus = req.query.bookingStatus;
  }

  if (req.query.paymentStatus) {
    validateEnum(req.query.paymentStatus, paymentStatuses, "paymentStatus");
    filters.paymentStatus = req.query.paymentStatus;
  }

  if (req.query.source) {
    validateEnum(req.query.source, bookingSources, "source");
    filters.source = req.query.source;
  }

  if (req.query.propertyId) {
    filters.propertyId = req.query.propertyId;
  }

  if (req.query.roomId) {
    filters.roomId = req.query.roomId;
  }

  const bookings = await Booking.find(filters)
    .populate("calendarEventId")
    .populate("invoiceId")
    .populate("paymentId")
    .populate("roomId")
    .sort({ createdAt: -1 });

  sendResponse(res, 200, "Bookings retrieved successfully", bookings);
});

const getBookingById = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, "booking id");

  const booking = await Booking.findById(req.params.id)
    .populate("calendarEventId")
    .populate("invoiceId")
    .populate("paymentId")
    .populate("roomId");

  if (!booking) {
    throw new AppError("Booking not found", 404);
  }

  sendResponse(res, 200, "Booking retrieved successfully", booking);
});

const getBookingByCode = asyncHandler(async (req, res) => {
  const bookingCode = String(req.params.bookingCode || "").trim().toUpperCase();

  const booking = await Booking.findOne({ bookingCode })
    .populate("calendarEventId")
    .populate("invoiceId")
    .populate("paymentId")
    .populate("roomId");

  if (!booking) {
    throw new AppError("Booking not found", 404);
  }

  sendResponse(res, 200, "Booking retrieved successfully", booking);
});

const cancelBooking = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, "booking id");

  const booking = await runWithOptionalTransaction(async (session) => {
    const bookingToCancel = await Booking.findById(req.params.id).session(session || null);

    if (!bookingToCancel) {
      throw new AppError("Booking not found", 404);
    }

    if (bookingToCancel.bookingStatus === "cancelled") {
      return bookingToCancel;
    }

    bookingToCancel.bookingStatus = "cancelled";
    await bookingToCancel.save(session ? { session } : undefined);

    await cancelBookingCalendarEvent(bookingToCancel._id, { session });

    if (bookingToCancel.invoiceId) {
      await Invoice.findByIdAndUpdate(
        bookingToCancel.invoiceId,
        { invoiceStatus: "cancelled" },
        { new: true, ...(session ? { session } : {}) }
      );
    }

    return Booking.findById(bookingToCancel._id)
      .populate("calendarEventId")
      .populate("invoiceId")
      .populate("paymentId")
      .populate("roomId")
      .session(session || null);
  });

  sendResponse(res, 200, "Booking cancelled successfully", booking);
});

module.exports = {
  createBooking,
  getBookings,
  getBookingById,
  getBookingByCode,
  cancelBooking
};
