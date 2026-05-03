const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const asyncHandler = require("../utils/asyncHandler");
const sendResponse = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const { validateEnum, validateObjectId } = require("../utils/validators");
const { rejectionReasons } = require("../models/Booking");
const {
  approvePayment: approvePaymentService,
  rejectPayment: rejectPaymentService
} = require("../services/adminApprovalService");

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
    .populate("calendarEventId")
    .populate("invoiceId")
    .sort({ updatedAt: -1 });

  const data = await attachLatestPayments(bookings);

  sendResponse(res, 200, "Waiting approval bookings retrieved successfully", data);
});

const getAdminBookingDetail = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, "booking id");

  const booking = await Booking.findById(req.params.id)
    .populate("calendarEventId")
    .populate("invoiceId");

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

module.exports = {
  getWaitingApprovalBookings,
  getAdminBookingDetail,
  approvePayment,
  rejectPayment
};
