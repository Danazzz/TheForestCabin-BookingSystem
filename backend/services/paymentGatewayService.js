const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const AppError = require("../utils/AppError");

const buildReference = (prefix, bookingId) => {
  const bookingSuffix = String(bookingId).slice(-6).toUpperCase();
  return `${prefix}-${Date.now()}-${bookingSuffix}`;
};

const createVirtualAccountPayment = async (booking) => {
  return {
    provider: "placeholder",
    paymentMethod: "va",
    transactionReference: buildReference("VA", booking._id),
    paymentInstructions: {
      bankCode: "BCA",
      virtualAccountNumber: `8808${String(Date.now()).slice(-10)}`,
      accountName: booking.guestName
    },
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  };
};

const createQrisPayment = async (booking) => {
  return {
    provider: "placeholder",
    paymentMethod: "qris",
    transactionReference: buildReference("QRIS", booking._id),
    paymentInstructions: {
      qrString: `QRIS-PLACEHOLDER-${booking._id}`,
      qrImageUrl: null
    },
    expiresAt: new Date(Date.now() + 30 * 60 * 1000)
  };
};

const handlePaymentWebhook = async (payload) => {
  const { transactionReference, paymentStatus } = payload;

  if (!transactionReference || !paymentStatus) {
    throw new AppError("transactionReference and paymentStatus are required", 400);
  }

  const payment = await Payment.findOne({ transactionReference });

  if (!payment) {
    throw new AppError("Payment not found for transactionReference", 404);
  }

  if (!["paid", "failed"].includes(paymentStatus)) {
    throw new AppError("paymentStatus must be paid or failed", 400);
  }

  payment.paymentStatus = paymentStatus;
  await payment.save();

  const bookingUpdate =
    paymentStatus === "paid"
      ? {
          paymentStatus: "paid",
          bookingStatus: "waiting_admin_approval"
        }
      : {
          paymentStatus: "failed",
          bookingStatus: "pending_payment"
        };

  const booking = await Booking.findByIdAndUpdate(payment.bookingId, bookingUpdate, {
    new: true
  });

  return {
    payment,
    booking
  };
};

module.exports = {
  createVirtualAccountPayment,
  createQrisPayment,
  handlePaymentWebhook
};
