const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const PaymentOption = require("../models/PaymentOption");
const asyncHandler = require("../utils/asyncHandler");
const sendResponse = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const {
  validateEnum,
  validateObjectId
} = require("../utils/validators");
const { paymentMethods } = require("../models/Payment");
const {
  createVirtualAccountPayment,
  createQrisPayment,
  handlePaymentWebhook
} = require("../services/paymentGatewayService");
const { getAssignedRoomsFromBooking } = require("../services/bookingRoomItemsService");

const buildReference = (paymentMethod, bookingId) => {
  const prefixByMethod = {
    manual_transfer: "BANK",
    virtual_account: "VA",
    qris: "QRIS",
    other: "OTHER"
  };
  const bookingSuffix = String(bookingId).slice(-6).toUpperCase();

  return `${prefixByMethod[paymentMethod] || "PAY"}-${Date.now()}-${bookingSuffix}`;
};

const buildManualProviderPayload = (booking, paymentOption) => {
  const snapshot = paymentOption.toSnapshot();
  const paymentInstructions = {
    name: snapshot.name,
    paymentMethod: snapshot.paymentMethod,
    providerLabel: snapshot.providerLabel,
    bankName: snapshot.bankName,
    accountName: snapshot.accountName,
    accountNumber: snapshot.accountNumber,
    merchantName: snapshot.merchantName,
    qrisCode: snapshot.qrisCode,
    imageUrl: snapshot.imageUrl,
    instructions: snapshot.instructions
  };

  if (snapshot.paymentMethod === "virtual_account") {
    paymentInstructions.virtualAccountNumber = snapshot.accountNumber;
    paymentInstructions.bankCode = snapshot.providerLabel || snapshot.bankName;
  }

  if (snapshot.paymentMethod === "qris") {
    paymentInstructions.qrString = snapshot.qrisCode;
    paymentInstructions.qrImageUrl = snapshot.imageUrl;
  }

  return {
    provider: "manual",
    paymentMethod: snapshot.paymentMethod,
    transactionReference: buildReference(snapshot.paymentMethod, booking._id),
    paymentInstructions,
    paymentOption: snapshot,
    expiresAt: booking.paymentDueAt || null
  };
};

const assertPaymentWindowOpen = (booking) => {
  if (!booking.paymentDueAt) {
    return;
  }

  if (new Date(booking.paymentDueAt) < new Date()) {
    throw new AppError(
      "Payment deadline has passed. Please contact admin to continue this booking.",
      409
    );
  }
};

const findActivePaymentOption = async ({ paymentMethod, paymentOptionId }) => {
  if (paymentOptionId) {
    validateObjectId(paymentOptionId, "payment option id");
    const option = await PaymentOption.findOne({
      _id: paymentOptionId,
      isActive: true
    });

    if (!option) {
      throw new AppError("Selected payment option is not available", 400);
    }

    if (paymentMethod && option.paymentMethod !== paymentMethod) {
      throw new AppError("paymentOptionId does not match paymentMethod", 400);
    }

    return option;
  }

  const option = await PaymentOption.findOne({
    paymentMethod,
    isActive: true
  }).sort({ createdAt: 1 });

  if (!option) {
    throw new AppError("No active payment option is configured for this method", 400);
  }

  return option;
};

const createPayment = asyncHandler(async (req, res) => {
  validateObjectId(req.params.bookingId, "booking id");
  const paymentMethodFromRequest =
    req.body.paymentMethod === "va" ? "virtual_account" : req.body.paymentMethod;

  if (!paymentMethodFromRequest && !req.body.paymentOptionId) {
    throw new AppError("paymentMethod or paymentOptionId is required", 400);
  }

  if (paymentMethodFromRequest) {
    validateEnum(paymentMethodFromRequest, paymentMethods, "paymentMethod");
  }

  const booking = await Booking.findById(req.params.bookingId);

  if (!booking) {
    throw new AppError("Booking not found", 404);
  }

  if (booking.bookingStatus === "waiting_availability_approval") {
    throw new AppError("Booking must be approved by admin before payment can be created", 409);
  }

  if (booking.bookingStatus !== "pending_payment") {
    throw new AppError("Payment can only be created for bookings pending payment", 409);
  }

  if (getAssignedRoomsFromBooking(booking).length === 0) {
    throw new AppError("Booking must have an assigned room before payment can be created", 409);
  }

  assertPaymentWindowOpen(booking);

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

  const paymentOption = await findActivePaymentOption({
    paymentMethod: paymentMethodFromRequest,
    paymentOptionId: req.body.paymentOptionId
  });
  const paymentMethod = paymentOption.paymentMethod;
  let providerPayload;

  if (paymentMethod === "virtual_account") {
    providerPayload = await createVirtualAccountPayment(booking);
  }

  if (paymentMethod === "qris") {
    providerPayload = await createQrisPayment(booking);
  }

  providerPayload = {
    ...providerPayload,
    ...buildManualProviderPayload(booking, paymentOption)
  };

  const payment = await Payment.create({
    bookingId: booking._id,
    paymentMethod,
    paymentOptionId: paymentOption._id,
    paymentOptionSnapshot: providerPayload.paymentOption,
    amount: booking.totalAmount,
    paymentStatus: "pending",
    expiresAt: booking.paymentDueAt || null,
    transactionReference: providerPayload.transactionReference
  });

  booking.bookingStatus = "pending_payment";
  booking.paymentStatus = "pending";
  booking.paymentId = payment._id;
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

  if (payment.paymentStatus === "paid") {
    throw new AppError("Payment is already paid", 409);
  }

  const currentBooking = await Booking.findById(payment.bookingId);

  if (!currentBooking) {
    throw new AppError("Booking not found for this payment", 404);
  }

  if (!["pending_payment", "waiting_admin_approval"].includes(currentBooking.bookingStatus)) {
    throw new AppError("Payment proof cannot be uploaded for this booking status", 409);
  }

  assertPaymentWindowOpen(currentBooking);

  payment.proofImageUrl = req.uploadedFileUrl;
  payment.proofImagePublicId = req.uploadedFilePublicId || "";
  payment.paymentStatus = "pending";
  payment.adminNote = null;
  payment.approvedAt = null;
  payment.approvedBy = null;
  payment.rejectedAt = null;
  await payment.save();

  const booking = await Booking.findByIdAndUpdate(
    payment.bookingId,
    {
      bookingStatus: "waiting_admin_approval",
      paymentStatus: "pending",
      paymentId: payment._id
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
