const Booking = require("../models/Booking");
const Promo = require("../models/Promo");
const Room = require("../models/Room");
const asyncHandler = require("../utils/asyncHandler");
const sendResponse = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const {
  requireFields,
  validateDateRange,
  validateEnum,
  validateObjectId,
  validatePositiveNumber
} = require("../utils/validators");
const { bookingStatuses, paymentStatuses } = require("../models/Booking");
const { cancelBooking: cancelBookingService } = require("../services/bookingCancellationService");
const { sendAdminBookingRequestEmail } = require("../services/emailService");
const {
  buildPricedRoomItems,
  getNights,
  normalizeRoomItemsPayload
} = require("../services/bookingRoomItemsService");

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

const validatePromoEligibility = (promo, { nights, roomType, roomTypes, totalRooms }) => {
  if (!promo) {
    return;
  }

  const stayNights = Number(nights || 0);
  const minNights = Number(promo.minNights || 0);
  const maxNights = Number(promo.maxNights || 0);
  const minRooms = Number(promo.minRooms || 0);
  const requestedRoomTypes = (roomTypes?.length ? roomTypes : [roomType])
    .map(Room.normalizeRoomType)
    .filter(Boolean);
  const eligibleRoomTypes = Array.isArray(promo.eligibleRoomTypes)
    ? promo.eligibleRoomTypes.map(Room.normalizeRoomType).filter(Boolean)
    : [];

  if (minNights > 0 && stayNights < minNights) {
    throw new AppError(`Selected promo requires at least ${minNights} night(s).`, 400);
  }

  if (maxNights > 0 && stayNights > maxNights) {
    throw new AppError(`Selected promo applies to stays up to ${maxNights} night(s).`, 400);
  }

  if (minRooms > 0 && Number(totalRooms || 0) < minRooms) {
    throw new AppError(`Selected promo requires at least ${minRooms} room(s).`, 400);
  }

  if (
    eligibleRoomTypes.length > 0 &&
    requestedRoomTypes.some((requestedRoomType) => !eligibleRoomTypes.includes(requestedRoomType))
  ) {
    throw new AppError("Selected promo is not available for the selected room type.", 400);
  }
};

const getActivePromo = async (promoId, eligibilityContext = {}) => {
  validateObjectId(promoId, "promo id");
  const promo = await Promo.findById(promoId);

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

  validatePromoEligibility(promo, eligibilityContext);

  return promo;
};

const createBooking = asyncHandler(async (req, res) => {
  requireFields(req.body, [
    "guestName",
    "guestEmail",
    "guestPhone",
    "checkIn",
    "checkOut",
  ]);

  const { startDate, endDate } = validateDateRange(req.body.checkIn, req.body.checkOut);
  const totalAmountFromRequest = req.body.totalAmount !== undefined
    ? validatePositiveNumber(req.body.totalAmount, "totalAmount", true)
    : null;
  const source = "direct";
  const nights = getNights(startDate, endDate);
  const requestedRoomItems = normalizeRoomItemsPayload(req.body);
  const roomItems = await buildPricedRoomItems(requestedRoomItems, { nights });
  const subtotalAmount = roomItems.reduce((total, item) => total + item.subtotal, 0);
  const totalRooms = roomItems.reduce((total, item) => total + item.roomCount, 0);
  const totalAdults = roomItems.reduce((total, item) => total + item.adultGuests, 0);
  const totalChildren = roomItems.reduce((total, item) => total + item.childGuests, 0);
  const primaryRoomType = roomItems[0]?.roomType;
  const promo = req.body.promoId
    ? await getActivePromo(req.body.promoId, {
        nights,
        roomTypes: roomItems.map((item) => item.roomType),
        totalRooms
      })
    : null;
  const totalAmount = promo
    ? Math.max(0, Math.round(applyPromoPricing(subtotalAmount, promo)))
    : totalAmountFromRequest ?? subtotalAmount;

  const booking = await Booking.create({
    guestName: req.body.guestName,
    guestEmail: req.body.guestEmail,
    guestPhone: req.body.guestPhone,
    propertyId: req.body.propertyId || "the-forest-cabin",
    roomId: null,
    roomType: primaryRoomType,
    checkIn: startDate,
    checkOut: endDate,
    numberOfGuests: totalAdults,
    numberOfChildren: totalChildren,
    numberOfRooms: totalRooms,
    roomItems,
    totalAmount,
    promoId: promo?._id || null,
    promoName: promo?.name || "",
    promoAdjustmentType: promo?.adjustmentType || "",
    promoAdjustmentValue: promo?.adjustmentValue || 0,
    source,
    sourceName: "Website direct",
    bookingStatus: "waiting_availability_approval",
    paymentStatus: "unpaid"
  });

  const createdBooking = await Booking.findById(booking._id)
    .populate("roomId")
    .populate("calendarEventIds");

  sendAdminBookingRequestEmail(createdBooking._id).catch(() => null);

  sendResponse(res, 201, "Booking request submitted successfully", createdBooking);
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
    filters.source = req.query.source;
  }

  if (req.query.propertyId) {
    filters.propertyId = req.query.propertyId;
  }

  if (req.query.roomId) {
    filters.$or = [
      { roomId: req.query.roomId },
      { "roomItems.assignedRooms.roomId": req.query.roomId }
    ];
  }

  const bookings = await Booking.find(filters)
    .populate("calendarEventId")
    .populate("calendarEventIds")
    .populate("invoiceId")
    .populate("paymentId")
    .populate("roomId")
    .sort({ createdAt: -1 });

  sendResponse(res, 200, "Bookings retrieved successfully", bookings);
});

const getBookingById = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, "booking id");

  const booking = await Booking.findById(req.params.id)
    .populate("calendarEventId")
    .populate("calendarEventIds")
    .populate("invoiceId")
    .populate("paymentId")
    .populate("roomId");

  if (!booking) {
    throw new AppError("Booking not found", 404);
  }

  sendResponse(res, 200, "Booking retrieved successfully", booking);
});

const getBookingByCode = asyncHandler(async (req, res) => {
  const bookingCode = String(req.params.bookingCode || "").trim().toUpperCase();

  const booking = await Booking.findOne({ bookingCode })
    .populate("calendarEventId")
    .populate("calendarEventIds")
    .populate("invoiceId")
    .populate("paymentId")
    .populate("roomId");

  if (!booking) {
    throw new AppError("Booking not found", 404);
  }

  sendResponse(res, 200, "Booking retrieved successfully", booking);
});

const cancelBooking = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, "booking id");

  const data = await cancelBookingService(req.params.id, {
    adminNote: req.body?.adminNote,
    cancellationReason: req.body?.cancellationReason || "guest_cancelled",
    cancelledBy: req.body?.cancelledBy || "guest"
  });

  sendResponse(res, 200, "Booking cancelled successfully", data.booking);
});

module.exports = {
  createBooking,
  getBookings,
  getBookingById,
  getBookingByCode,
  cancelBooking
};
