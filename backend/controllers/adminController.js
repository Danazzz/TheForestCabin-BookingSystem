const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const Room = require("../models/Room");
const asyncHandler = require("../utils/asyncHandler");
const sendResponse = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const { requireFields, validateEnum, validateObjectId } = require("../utils/validators");
const { rejectionReasons } = require("../models/Booking");
const {
  approvePayment: approvePaymentService,
  rejectPayment: rejectPaymentService
} = require("../services/adminApprovalService");
const { checkRoomAvailability } = require("../services/availabilityService");
const { createManualBooking: createManualBookingService } = require("../services/manualBookingService");

const attachLatestPayments = async (bookings) => {
  const bookingIds = bookings.map((booking) => booking._id);
  const payments = await Payment.find({ bookingId: { $in: bookingIds } }).sort({
    createdAt: -1
  });

  const latestPaymentByBooking = new Map();
  payments.forEach((payment) => {
    const key = String(payment.bookingId);

    if (!latestPaymentByBooking.has(key)) {
      latestPaymentByBooking.set(key, payment);
    }
  });

  return bookings.map((booking) => ({
    ...booking.toObject(),
    latestPayment: latestPaymentByBooking.get(String(booking._id)) || null
  }));
};

const getWaitingApprovalBookings = asyncHandler(async (req, res) => {
  const bookings = await Booking.find({ bookingStatus: "waiting_admin_approval" })
    .populate("roomId")
    .populate("paymentId")
    .populate("calendarEventId")
    .populate("invoiceId")
    .sort({ updatedAt: -1 });

  const data = await attachLatestPayments(bookings);

  sendResponse(res, 200, "Waiting approval bookings retrieved successfully", data);
});

const getAdminBookings = asyncHandler(async (req, res) => {
  const filters = {};

  if (req.query.bookingStatus) {
    filters.bookingStatus = req.query.bookingStatus;
  }

  if (req.query.paymentStatus) {
    filters.paymentStatus = req.query.paymentStatus;
  }

  if (req.query.roomType && req.query.roomType !== "all") {
    filters.roomType = Room.normalizeRoomType(req.query.roomType);
  }

  if (req.query.source && req.query.source !== "all") {
    filters.source = req.query.source;
  }

  const bookings = await Booking.find(filters)
    .populate("roomId")
    .populate("paymentId")
    .populate("invoiceId")
    .populate("calendarEventId")
    .sort({ createdAt: -1 });

  const data = await attachLatestPayments(bookings);

  sendResponse(res, 200, "Bookings retrieved successfully", data);
});

const createManualBooking = asyncHandler(async (req, res) => {
  requireFields(req.body, [
    "guestName",
    "guestPhone",
    "checkIn",
    "checkOut",
    "numberOfGuests"
  ]);

  const booking = await createManualBookingService(req.body, {
    approvedBy: req.user?.id || req.body?.approvedBy
  });

  sendResponse(res, 201, "Manual booking created successfully", booking);
});

const getAdminBookingDetail = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, "booking id");

  const booking = await Booking.findById(req.params.id)
    .populate("calendarEventId")
    .populate("invoiceId")
    .populate("paymentId")
    .populate("roomId");

  if (!booking) {
    throw new AppError("Booking not found", 404);
  }

  const payments = await Payment.find({ bookingId: booking._id }).sort({ createdAt: -1 });

  sendResponse(res, 200, "Admin booking detail retrieved successfully", {
    booking,
    payments
  });
});

const approvePayment = asyncHandler(async (req, res) => {
  validateObjectId(req.params.paymentId, "payment id");

  const data = await approvePaymentService(req.params.paymentId, {
    approvedBy: req.user?.id || req.body?.approvedBy,
    adminNote: req.body?.adminNote
  });

  sendResponse(res, 200, "Payment approved successfully", data);
});

const rejectPayment = asyncHandler(async (req, res) => {
  validateObjectId(req.params.paymentId, "payment id");
  const rejectionReason = req.body?.rejectionReason || "other";
  validateEnum(rejectionReason, rejectionReasons, "rejectionReason");

  const data = await rejectPaymentService(req.params.paymentId, {
    approvedBy: req.user?.id || req.body?.approvedBy,
    adminNote: req.body?.adminNote,
    rejectionReason
  });

  sendResponse(res, 200, "Payment rejected successfully", data);
});

const checkAdminAvailability = asyncHandler(async (req, res) => {
  requireFields(req.body, ["roomId", "checkIn", "checkOut"]);
  validateObjectId(req.body.roomId, "room id");

  const result = await checkRoomAvailability({
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
  getAdminBookings,
  createManualBooking,
  getWaitingApprovalBookings,
  getAdminBookingDetail,
  approvePayment,
  rejectPayment,
  checkAdminAvailability
};
