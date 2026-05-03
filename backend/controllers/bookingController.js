const Booking = require("../models/Booking");
const Invoice = require("../models/Invoice");
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

const createBooking = asyncHandler(async (req, res) => {
  requireFields(req.body, [
    "guestName",
    "guestEmail",
    "guestPhone",
    "propertyId",
    "roomId",
    "roomType",
    "checkIn",
    "checkOut",
    "numberOfGuests",
    "totalAmount"
  ]);

  const { startDate, endDate } = validateDateRange(req.body.checkIn, req.body.checkOut);
  const numberOfGuests = validatePositiveNumber(req.body.numberOfGuests, "numberOfGuests");
  const totalAmount = validatePositiveNumber(req.body.totalAmount, "totalAmount", true);
  const source = req.body.source || "direct";
  validateEnum(source, bookingSources, "source");

  const booking = await Booking.create({
    guestName: req.body.guestName,
    guestEmail: req.body.guestEmail,
    guestPhone: req.body.guestPhone,
    propertyId: req.body.propertyId,
    roomId: req.body.roomId,
    roomType: req.body.roomType,
    checkIn: startDate,
    checkOut: endDate,
    numberOfGuests,
    totalAmount,
    source,
    bookingStatus: "draft",
    paymentStatus: "unpaid"
  });

  sendResponse(res, 201, "Booking created successfully", booking);
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
    .sort({ createdAt: -1 });

  sendResponse(res, 200, "Bookings retrieved successfully", bookings);
});

const getBookingById = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, "booking id");

  const booking = await Booking.findById(req.params.id)
    .populate("calendarEventId")
    .populate("invoiceId");

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
      .session(session || null);
  });

  sendResponse(res, 200, "Booking cancelled successfully", booking);
});

module.exports = {
  createBooking,
  getBookings,
  getBookingById,
  cancelBooking
};
