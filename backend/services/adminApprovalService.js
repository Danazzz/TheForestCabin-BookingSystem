const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const AppError = require("../utils/AppError");
const runWithOptionalTransaction = require("../utils/runWithOptionalTransaction");
const {
  assertAvailability,
  createCalendarEventForBooking
} = require("./calendarService");
const { generateInvoiceForBooking } = require("./invoiceService");
const { sendInvoiceEmail } = require("./emailService");
const { getAssignedRoomsFromBooking } = require("./bookingRoomItemsService");

const sessionOption = (session) => (session ? { session } : undefined);
const APPROVAL_UNAVAILABLE_MESSAGE =
  "Cannot approve booking because the room is no longer available.";
const rejectionReasons = Booking.rejectionReasons;

const getBookingApprovalPayload = async (bookingId, { session } = {}) => {
  const booking = await Booking.findById(bookingId)
    .populate("calendarEventId")
    .populate("calendarEventIds")
    .populate("invoiceId")
    .session(session || null);

  const payments = await Payment.find({ bookingId }).sort({ createdAt: -1 }).session(session || null);

  return {
    booking,
    payments
  };
};

const approvePayment = async (paymentId, { approvedBy, adminNote } = {}) => {
  const result = await runWithOptionalTransaction(async (session) => {
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

    if (getAssignedRoomsFromBooking(booking).length === 0) {
      throw new AppError("Booking must be approved for availability before payment approval", 409);
    }

    if (!payment.proofImageUrl) {
      throw new AppError("Payment proof is required before approval", 400);
    }

    for (const assignedRoom of getAssignedRoomsFromBooking(booking)) {
      await assertAvailability(
        {
          roomId: assignedRoom.roomId,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          excludeBookingId: booking._id
        },
        {
          session,
          message: APPROVAL_UNAVAILABLE_MESSAGE
        }
      );
    }

    payment.paymentStatus = "paid";
    payment.approvedBy = approvedBy || "system-admin";
    payment.approvedAt = new Date();
    payment.rejectedAt = null;
    payment.adminNote = adminNote || payment.adminNote || null;
    await payment.save(sessionOption(session));

    const calendarEvent = await createCalendarEventForBooking(booking, {
      session,
      availabilityMessage: APPROVAL_UNAVAILABLE_MESSAGE
    });
    const invoice = await generateInvoiceForBooking(booking, payment, { session });

    booking.bookingStatus = "success";
    booking.paymentStatus = "paid";
    booking.calendarEventId = calendarEvent._id;
    booking.calendarEventIds = calendarEvent.calendarEventIds || [calendarEvent._id];
    booking.invoiceId = invoice._id;
    booking.paymentId = payment._id;
    booking.approvedAt = new Date();
    booking.rejectedAt = null;
    booking.rejectionReason = null;
    await booking.save(sessionOption(session));

    return getBookingApprovalPayload(booking._id, { session });
  });

  const invoiceId = result?.booking?.invoiceId?._id || result?.booking?.invoiceId;

  if (invoiceId) {
    await sendInvoiceEmail(invoiceId).catch(() => null);
    return getBookingApprovalPayload(result.booking._id);
  }

  return result;
};

const rejectPayment = async (
  paymentId,
  { adminNote, approvedBy, rejectionReason = "other" } = {}
) => {
  return runWithOptionalTransaction(async (session) => {
    if (!rejectionReasons.includes(rejectionReason)) {
      throw new AppError(
        `rejectionReason must be one of: ${rejectionReasons.join(", ")}`,
        400
      );
    }

    const payment = await Payment.findById(paymentId).session(session || null);

    if (!payment) {
      throw new AppError("Payment not found", 404);
    }

    const booking = await Booking.findById(payment.bookingId).session(session || null);

    if (!booking) {
      throw new AppError("Booking not found for this payment", 404);
    }

    if (booking.bookingStatus === "success") {
      throw new AppError("Successful bookings cannot be rejected from payment review", 409);
    }

    const paymentWasPaid = payment.paymentStatus === "paid";
    const rejectedAdminNote = adminNote || rejectionReason;

    payment.paymentStatus = "rejected";
    payment.adminNote = rejectedAdminNote;
    payment.approvedBy = approvedBy || "system-admin";
    payment.approvedAt = null;
    payment.rejectedAt = new Date();
    await payment.save(sessionOption(session));

    booking.bookingStatus = "rejected";
    booking.paymentStatus = paymentWasPaid ? "refund_required" : "rejected";
    booking.rejectionReason = rejectionReason;
    booking.adminNote = rejectedAdminNote;
    booking.rejectedAt = new Date();
    booking.rejectedBy = approvedBy || "system-admin";
    await booking.save(sessionOption(session));

    return getBookingApprovalPayload(booking._id, { session });
  });
};

module.exports = {
  approvePayment,
  rejectPayment,
  getBookingApprovalPayload,
  APPROVAL_UNAVAILABLE_MESSAGE
};
