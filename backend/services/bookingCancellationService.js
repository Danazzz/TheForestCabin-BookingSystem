const Booking = require("../models/Booking");
const Invoice = require("../models/Invoice");
const Payment = require("../models/Payment");
const AppError = require("../utils/AppError");
const runWithOptionalTransaction = require("../utils/runWithOptionalTransaction");
const { cancelBookingCalendarEvent } = require("./calendarService");

const sessionOption = (session) => (session ? { session } : undefined);
const cancellationReasons = Booking.rejectionReasons;

const getCancellationPayload = async (bookingId, { session } = {}) => {
  const booking = await Booking.findById(bookingId)
    .populate("calendarEventId")
    .populate("invoiceId")
    .populate("paymentId")
    .populate("roomId")
    .session(session || null);

  const payments = await Payment.find({ bookingId }).sort({ createdAt: -1 }).session(session || null);

  return {
    booking,
    payments
  };
};

const resolveCancelledPaymentStatus = ({ booking, payments }) => {
  const hasPaidPayment =
    booking.paymentStatus === "paid" ||
    payments.some((payment) => payment.paymentStatus === "paid");

  if (hasPaidPayment) {
    return "refund_required";
  }

  const hasPendingPayment =
    booking.paymentStatus === "pending" ||
    payments.some((payment) => payment.paymentStatus === "pending");

  if (hasPendingPayment) {
    return "rejected";
  }

  return "unpaid";
};

const cancelBooking = async (
  bookingId,
  { adminNote, cancellationReason = "guest_cancelled", cancelledBy } = {}
) => {
  if (!cancellationReasons.includes(cancellationReason)) {
    throw new AppError(
      `cancellationReason must be one of: ${cancellationReasons.join(", ")}`,
      400
    );
  }

  return runWithOptionalTransaction(async (session) => {
    const booking = await Booking.findById(bookingId).session(session || null);

    if (!booking) {
      throw new AppError("Booking not found", 404);
    }

    if (booking.bookingStatus === "cancelled") {
      return getCancellationPayload(booking._id, { session });
    }

    if (booking.bookingStatus === "rejected") {
      throw new AppError("Rejected bookings are already closed", 409);
    }

    const payments = await Payment.find({ bookingId: booking._id })
      .sort({ createdAt: -1 })
      .session(session || null);
    const cancelledAt = new Date();
    const finalAdminNote = adminNote || cancellationReason;
    const actor = cancelledBy || "system-admin";

    await Payment.updateMany(
      { bookingId: booking._id, paymentStatus: "pending" },
      {
        paymentStatus: "rejected",
        adminNote: finalAdminNote,
        approvedBy: actor,
        rejectedAt: cancelledAt
      },
      sessionOption(session)
    );

    booking.bookingStatus = "cancelled";
    booking.paymentStatus = resolveCancelledPaymentStatus({ booking, payments });
    booking.cancellationReason = cancellationReason;
    booking.rejectionReason = cancellationReason;
    booking.adminNote = finalAdminNote;
    booking.cancelledAt = cancelledAt;
    booking.cancelledBy = actor;
    await booking.save(sessionOption(session));

    await cancelBookingCalendarEvent(booking._id, { session });

    await Invoice.findOneAndUpdate(
      { bookingId: booking._id },
      { invoiceStatus: "cancelled" },
      { new: true, ...sessionOption(session) }
    );

    return getCancellationPayload(booking._id, { session });
  });
};

module.exports = {
  cancelBooking,
  getCancellationPayload,
  cancellationReasons
};
