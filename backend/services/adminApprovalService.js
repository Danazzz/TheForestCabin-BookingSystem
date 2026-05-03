const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const AppError = require("../utils/AppError");
const runWithOptionalTransaction = require("../utils/runWithOptionalTransaction");
const {
  assertAvailability,
  createCalendarEventForBooking
} = require("./calendarService");
const { generateInvoiceForBooking } = require("./invoiceService");

const sessionOption = (session) => (session ? { session } : undefined);

const getBookingApprovalPayload = async (bookingId, { session } = {}) => {
  const booking = await Booking.findById(bookingId)
    .populate("calendarEventId")
    .populate("invoiceId")
    .session(session || null);

  const payments = await Payment.find({ bookingId }).sort({ createdAt: -1 }).session(session || null);

  return {
    booking,
    payments
  };
};

const approvePayment = async (paymentId, { approvedBy, adminNote } = {}) => {
  return runWithOptionalTransaction(async (session) => {
    const payment = await Payment.findById(paymentId).session(session || null);

    if (!payment) {
      throw new AppError("Payment not found", 404);
    }

    if (!["pending", "paid"].includes(payment.paymentStatus)) {
      throw new AppError(
        "Only pending or gateway-paid payments can be approved",
        409
      );
    }

    const booking = await Booking.findById(payment.bookingId).session(session || null);

    if (!booking) {
      throw new AppError("Booking not found for this payment", 404);
    }

    if (booking.bookingStatus === "cancelled") {
      throw new AppError("Cancelled booking cannot be approved", 409);
    }

    if (payment.paymentMethod === "manual_transfer" && !payment.proofImageUrl) {
      throw new AppError("Manual transfer payment requires proof upload before approval", 400);
    }

    await assertAvailability(
      {
        roomId: booking.roomId,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        excludeBookingId: booking._id
      },
      { session }
    );

    payment.paymentStatus = "paid";
    payment.approvedBy = approvedBy || "system-admin";
    payment.approvedAt = new Date();
    payment.adminNote = adminNote || payment.adminNote || null;
    await payment.save(sessionOption(session));

    const calendarEvent = await createCalendarEventForBooking(booking, { session });
    const invoice = await generateInvoiceForBooking(booking, payment, { session });

    booking.bookingStatus = "success";
    booking.paymentStatus = "paid";
    booking.calendarEventId = calendarEvent._id;
    booking.invoiceId = invoice._id;
    await booking.save(sessionOption(session));

    return getBookingApprovalPayload(booking._id, { session });
  });
};

const rejectPayment = async (paymentId, { adminNote, approvedBy } = {}) => {
  return runWithOptionalTransaction(async (session) => {
    const payment = await Payment.findById(paymentId).session(session || null);

    if (!payment) {
      throw new AppError("Payment not found", 404);
    }

    const booking = await Booking.findById(payment.bookingId).session(session || null);

    if (!booking) {
      throw new AppError("Booking not found for this payment", 404);
    }

    if (booking.bookingStatus === "success" || payment.paymentStatus === "paid") {
      throw new AppError("Paid or successful bookings cannot be rejected", 409);
    }

    payment.paymentStatus = "rejected";
    payment.adminNote = adminNote || "Payment rejected by admin";
    payment.approvedBy = approvedBy || "system-admin";
    payment.approvedAt = null;
    await payment.save(sessionOption(session));

    booking.bookingStatus = "rejected";
    booking.paymentStatus = "failed";
    await booking.save(sessionOption(session));

    return getBookingApprovalPayload(booking._id, { session });
  });
};

module.exports = {
  approvePayment,
  rejectPayment,
  getBookingApprovalPayload
};
