const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const asyncHandler = require("../utils/asyncHandler");
const sendResponse = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const {
  requireFields,
  validateEnum,
  validateObjectId
} = require("../utils/validators");
const { paymentMethods } = require("../models/Payment");
const {
  createVirtualAccountPayment,
  createQrisPayment,
  handlePaymentWebhook
} = require("../services/paymentGatewayService");

const buildManualTransferPayload = (booking) => ({
  provider: "manual",
  paymentMethod: "manual_transfer",
  transactionReference: `MANUAL-${Date.now()}-${String(booking._id).slice(-6).toUpperCase()}`,
  paymentInstructions: {
    bankName: "Set bank account details in your frontend or admin settings",
    accountNumber: "0000000000",
    accountName: "The Forest Cabin"
  },
  expiresAt: null
});

const createPayment = asyncHandler(async (req, res) => {
  validateObjectId(req.params.bookingId, "booking id");
  requireFields(req.body, ["paymentMethod"]);
  validateEnum(req.body.paymentMethod, paymentMethods, "paymentMethod");

  const booking = await Booking.findById(req.params.bookingId);

  if (!booking) {
    throw new AppError("Booking not found", 404);
  }

  if (["success", "cancelled"].includes(booking.bookingStatus)) {
    throw new AppError("Cannot create a new payment for this booking status", 409);
  }

  const activePayment = await Payment.findOne({
    bookingId: booking._id,
    paymentStatus: { $in: ["pending", "paid"] }
  }).sort({ createdAt: -1 });

  if (activePayment) {
    throw new AppError("An active payment already exists for this booking", 409, {
      paymentId: activePayment._id,
      paymentStatus: activePayment.paymentStatus
    });
  }

  let providerPayload;

  if (req.body.paymentMethod === "va") {
    providerPayload = await createVirtualAccountPayment(booking);
  }

  if (req.body.paymentMethod === "qris") {
    providerPayload = await createQrisPayment(booking);
  }

  if (req.body.paymentMethod === "manual_transfer") {
    providerPayload = buildManualTransferPayload(booking);
  }

  const payment = await Payment.create({
    bookingId: booking._id,
    paymentMethod: req.body.paymentMethod,
    amount: booking.totalAmount,
    paymentStatus: "pending",
    transactionReference: providerPayload.transactionReference
  });

  booking.bookingStatus = "pending_payment";
  booking.paymentStatus = "pending";
  await booking.save();

  sendResponse(res, 201, "Payment created successfully", {
    booking,
    payment,
    providerPayload
  });
});

const uploadPaymentProof = asyncHandler(async (req, res) => {
  validateObjectId(req.params.paymentId, "payment id");

  const payment = await Payment.findById(req.params.paymentId);

  if (!payment) {
    throw new AppError("Payment not found", 404);
  }

  if (payment.paymentMethod !== "manual_transfer") {
    throw new AppError("Payment proof upload is only allowed for manual transfers", 400);
  }

  if (payment.paymentStatus === "paid") {
    throw new AppError("Payment is already paid", 409);
  }

  const proofPath = `/uploads/payment-proofs/${req.file.filename}`;

  payment.proofImageUrl = proofPath;
  payment.paymentStatus = "pending";
  payment.adminNote = null;
  payment.approvedAt = null;
  payment.approvedBy = null;
  await payment.save();

  const booking = await Booking.findByIdAndUpdate(
    payment.bookingId,
    {
      bookingStatus: "waiting_admin_approval",
      paymentStatus: "pending"
    },
    { new: true }
  );

  sendResponse(res, 200, "Payment proof uploaded successfully", {
    booking,
    payment
  });
});

const getPaymentsByBooking = asyncHandler(async (req, res) => {
  validateObjectId(req.params.bookingId, "booking id");

  const payments = await Payment.find({ bookingId: req.params.bookingId }).sort({
    createdAt: -1
  });

  sendResponse(res, 200, "Payments retrieved successfully", payments);
});

const webhook = asyncHandler(async (req, res) => {
  const result = await handlePaymentWebhook(req.body);
  sendResponse(res, 200, "Payment webhook handled successfully", result);
});

module.exports = {
  createPayment,
  uploadPaymentProof,
  getPaymentsByBooking,
  webhook
};
