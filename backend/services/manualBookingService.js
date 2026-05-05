const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const Promo = require("../models/Promo");
const Room = require("../models/Room");
const AppError = require("../utils/AppError");
const runWithOptionalTransaction = require("../utils/runWithOptionalTransaction");
const {
  validateDateRange,
  validateObjectId,
  validatePositiveNumber
} = require("../utils/validators");
const {
  assertRoomAvailable,
  assertRoomExistsAndActive,
  findAvailableRoomByType
} = require("./availabilityService");
const { createCalendarEventForBooking } = require("./calendarService");
const { generateInvoiceForBooking } = require("./invoiceService");
const { sendInvoiceEmail } = require("./emailService");

const sessionOption = (session) => (session ? { session } : undefined);
const manualBookingStatuses = ["pending_payment", "success"];
const manualPaymentStatuses = ["unpaid", "paid"];

const getNights = (checkIn, checkOut) => {
  const milliseconds = new Date(checkOut).getTime() - new Date(checkIn).getTime();

  return Math.ceil(milliseconds / (1000 * 60 * 60 * 24));
};

const applyPromoPricing = (subtotal, promo) => {
  if (!promo || subtotal <= 0) {
    return subtotal;
  }

  const value = Number(promo.adjustmentValue || 0);

  if (promo.adjustmentType === "percentage_discount") {
    return subtotal - subtotal * Math.min(value, 100) / 100;
  }

  if (promo.adjustmentType === "fixed_discount") {
    return subtotal - value;
  }

  if (promo.adjustmentType === "bundle_price") {
    return value;
  }

  if (promo.adjustmentType === "surcharge") {
    return subtotal + value;
  }

  return subtotal;
};

const getActivePromo = async (promoId, { session } = {}) => {
  if (!promoId) {
    return null;
  }

  validateObjectId(promoId, "promo id");
  const promo = await Promo.findById(promoId).session(session || null);

  if (!promo || !promo.isActive) {
    throw new AppError("Selected promo is not available", 400);
  }

  const now = new Date();

  if (promo.validFrom && promo.validFrom > now) {
    throw new AppError("Selected promo is not active yet", 400);
  }

  if (promo.validUntil && promo.validUntil < now) {
    throw new AppError("Selected promo has expired", 400);
  }

  return promo;
};

const validateManualEnums = ({ bookingStatus, paymentStatus }) => {
  if (!manualBookingStatuses.includes(bookingStatus)) {
    throw new AppError(
      `bookingStatus must be one of: ${manualBookingStatuses.join(", ")}`,
      400
    );
  }

  if (!manualPaymentStatuses.includes(paymentStatus)) {
    throw new AppError(
      `paymentStatus must be one of: ${manualPaymentStatuses.join(", ")}`,
      400
    );
  }

  if (bookingStatus === "pending_payment" && paymentStatus !== "unpaid") {
    throw new AppError("Pending manual bookings must have unpaid payment status", 400);
  }

  if (bookingStatus === "success" && paymentStatus !== "paid") {
    throw new AppError("Successful manual bookings must have paid payment status", 400);
  }
};

const selectManualRoom = async ({ roomId, roomType, checkIn, checkOut }, { session } = {}) => {
  let room;

  if (roomId) {
    validateObjectId(roomId, "room id");
    room = await assertRoomExistsAndActive(roomId, { session });

    if (roomType && room.roomType !== Room.normalizeRoomType(roomType)) {
      throw new AppError("roomId does not match selected roomType", 400);
    }
  } else {
    if (!roomType) {
      throw new AppError("roomType is required when roomId is not provided", 400);
    }

    room = await findAvailableRoomByType({
      roomType: Room.normalizeRoomType(roomType),
      checkIn,
      checkOut
    });
  }

  await assertRoomAvailable({ roomId: room._id, checkIn, checkOut }, { session });

  return room;
};

const createManualPayment = async ({ booking, paymentStatus, adminNote, session }) => {
  if (paymentStatus === "unpaid") {
    return null;
  }

  const [payment] = await Payment.create(
    [
      {
        bookingId: booking._id,
        paymentMethod: "other",
        amount: booking.totalAmount,
        paymentStatus: "paid",
        transactionReference: `ADMIN-${Date.now()}-${String(booking._id).slice(-6).toUpperCase()}`,
        adminNote: adminNote || "Created from admin manual booking",
        approvedBy: "system-admin",
        approvedAt: new Date()
      }
    ],
    sessionOption(session)
  );

  return payment;
};

const createManualBooking = async (payload, { approvedBy } = {}) => {
  let invoiceIdToEmail = null;

  const result = await runWithOptionalTransaction(async (session) => {
    const { startDate, endDate } = validateDateRange(payload.checkIn, payload.checkOut);
    const bookingStatus = payload.bookingStatus || "pending_payment";
    const paymentStatus = payload.paymentStatus || "unpaid";
    validateManualEnums({ bookingStatus, paymentStatus });

    const numberOfGuests = validatePositiveNumber(
      payload.numberOfGuests,
      "numberOfGuests"
    );
    const numberOfChildren = validatePositiveNumber(
      payload.numberOfChildren ?? 0,
      "numberOfChildren",
      true
    );
    const room = await selectManualRoom(
      {
        roomId: payload.roomId,
        roomType: payload.roomType,
        checkIn: startDate,
        checkOut: endDate
      },
      { session }
    );

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

    const promo = payload.promoId ? await getActivePromo(payload.promoId, { session }) : null;
    const subtotalAmount = room.basePrice * getNights(startDate, endDate);
    const calculatedTotal = promo
      ? Math.max(0, Math.round(applyPromoPricing(subtotalAmount, promo)))
      : subtotalAmount;
    const totalAmount = payload.overrideTotal
      ? validatePositiveNumber(payload.totalAmount ?? calculatedTotal, "totalAmount", true)
      : calculatedTotal;

    const [booking] = await Booking.create(
      [
        {
          guestName: payload.guestName,
          guestEmail: payload.guestEmail || "",
          guestPhone: payload.guestPhone,
          propertyId: payload.propertyId || "the-forest-cabin",
          roomId: room._id,
          roomType: room.roomType,
          checkIn: startDate,
          checkOut: endDate,
          numberOfGuests,
          numberOfChildren,
          totalAmount,
          promoId: promo?._id || null,
          promoName: promo?.name || "",
          promoAdjustmentType: promo?.adjustmentType || "",
          promoAdjustmentValue: promo?.adjustmentValue || 0,
          source: "manual_admin",
          bookingStatus,
          paymentStatus,
          adminNote: payload.adminNote || null,
          approvedAt: bookingStatus === "success" ? new Date() : null
        }
      ],
      sessionOption(session)
    );

    const payment = await createManualPayment({
      booking,
      paymentStatus,
      adminNote: payload.adminNote,
      session
    });

    if (payment) {
      booking.paymentId = payment._id;
    }

    if (bookingStatus === "success") {
      const calendarEvent = await createCalendarEventForBooking(booking, {
        session,
        availabilityMessage:
          "Cannot create manual booking because the room is no longer available."
      });
      const invoice = await generateInvoiceForBooking(booking, payment, { session });

      booking.calendarEventId = calendarEvent._id;
      booking.invoiceId = invoice._id;
      booking.paymentId = payment._id;
      invoiceIdToEmail = invoice._id;
    }

    await booking.save(sessionOption(session));

    return Booking.findById(booking._id)
      .populate("roomId")
      .populate("paymentId")
      .populate("invoiceId")
      .populate("calendarEventId")
      .session(session || null);
  });

  if (invoiceIdToEmail) {
    await sendInvoiceEmail(invoiceIdToEmail).catch(() => null);
  }

  return Booking.findById(result._id)
    .populate("roomId")
    .populate("paymentId")
    .populate("invoiceId")
    .populate("calendarEventId");
};

module.exports = {
  createManualBooking,
  manualBookingStatuses,
  manualPaymentStatuses
};
