const Booking = require("../models/Booking");
const Channel = require("../models/Channel");
const Invoice = require("../models/Invoice");
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
  findAvailableRoomsByType,
  findAvailableRoomByType
} = require("./availabilityService");
const {
  cancelCalendarEventByBooking,
  createCalendarEventForBooking
} = require("./calendarService");
const {
  generateInvoiceForBooking,
  syncInvoiceForBooking
} = require("./invoiceService");
const { sendInvoiceEmail } = require("./emailService");
const {
  buildPricedRoomItems,
  buildRoomSnapshot,
  getNights,
  hydrateAssignedRoomSnapshots,
  normalizeRoomItemsPayload
} = require("./bookingRoomItemsService");

const sessionOption = (session) => (session ? { session } : undefined);
const manualBookingStatuses = ["pending_payment", "success"];
const manualPaymentStatuses = ["unpaid", "paid"];
const editableBookingStatuses = Booking.bookingStatuses || [
  "waiting_availability_approval",
  "pending_payment",
  "waiting_admin_approval",
  "success",
  "rejected",
  "cancelled"
];
const editablePaymentStatuses = Booking.paymentStatuses || [
  "unpaid",
  "pending",
  "paid",
  "rejected",
  "refund_required"
];

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

const getActivePromo = async (
  promoId,
  { session, nights, roomType, roomTypes, totalRooms } = {}
) => {
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

  validatePromoEligibility(promo, { nights, roomType, roomTypes, totalRooms });

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

const validateEditableEnums = ({ bookingStatus, paymentStatus }) => {
  if (!editableBookingStatuses.includes(bookingStatus)) {
    throw new AppError(
      `bookingStatus must be one of: ${editableBookingStatuses.join(", ")}`,
      400
    );
  }

  if (!editablePaymentStatuses.includes(paymentStatus)) {
    throw new AppError(
      `paymentStatus must be one of: ${editablePaymentStatuses.join(", ")}`,
      400
    );
  }

  if (bookingStatus === "success" && paymentStatus !== "paid") {
    throw new AppError("Successful bookings must have paid payment status", 400);
  }

  if (bookingStatus === "pending_payment" && paymentStatus === "paid") {
    throw new AppError("Pending payment bookings cannot have paid payment status", 400);
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

const resolveManualBookingSource = async (payload, { session } = {}) => {
  const rawSource = String(payload.source || "").trim();
  const rawSourceName = String(payload.sourceName || "").trim();

  if (!rawSource && !rawSourceName) {
    return {
      source: "manual_admin",
      sourceName: "Manual admin"
    };
  }

  const normalizedSource = rawSource ? Channel.normalizeChannelKey(rawSource) : "";
  const channelClauses = [
    ...(normalizedSource ? [{ key: normalizedSource }] : []),
    ...(rawSourceName ? [{ name: rawSourceName }] : [])
  ];

  if (rawSource && !normalizedSource) {
    throw new AppError("source must contain at least one letter or number", 400);
  }

  const channelQuery = payload.channelId
    ? { _id: payload.channelId, isActive: true }
    : {
        isActive: true,
        $or: channelClauses
      };

  if (payload.channelId) {
    validateObjectId(payload.channelId, "channel id");
  }

  const channel = await Channel.findOne(channelQuery).session(session || null);

  if (channel) {
    return {
      source: channel.key,
      sourceName: channel.name
    };
  }

  if (normalizedSource) {
    return {
      source: normalizedSource,
      sourceName: rawSourceName || rawSource
    };
  }

  const fallbackSource = Channel.normalizeChannelKey(rawSourceName);

  if (!fallbackSource) {
    throw new AppError("source must contain at least one letter or number", 400);
  }

  return {
    source: fallbackSource,
    sourceName: rawSourceName
  };
};

const validateAssignedRoomCapacity = (item, rooms) => {
  const adultCapacity = rooms.reduce((total, room) => total + (room.capacity || 0), 0);
  const childCapacity = rooms.reduce((total, room) => total + (room.childCapacity || 0), 0);

  if ((item.adultGuests || 0) > adultCapacity) {
    throw new AppError(
      `Selected ${item.roomType} room(s) can host up to ${adultCapacity} adult guests`,
      400
    );
  }

  if ((item.childGuests || 0) > childCapacity) {
    throw new AppError(
      `Selected ${item.roomType} room(s) can host up to ${childCapacity} children`,
      400
    );
  }
};

const assignManualRoomItems = async (
  roomItems,
  payload,
  { checkIn, checkOut, session, excludeBookingId } = {}
) => {
  const assignedRoomIds = new Set();

  for (let index = 0; index < roomItems.length; index += 1) {
    const item = roomItems[index];
    const explicitItem = Array.isArray(payload.roomItems) ? payload.roomItems[index] : null;
    const explicitRoomIds = explicitItem?.assignedRoomIds || explicitItem?.roomIds || [];

    if (payload.roomId && index === 0 && item.roomCount === 1 && explicitRoomIds.length === 0) {
      const room = await assertRoomExistsAndActive(payload.roomId, { session });

      if (room.roomType !== item.roomType) {
        throw new AppError("roomId does not match selected roomType", 400);
      }

      await assertRoomAvailable(
        { roomId: room._id, checkIn, checkOut, excludeBookingId },
        { session }
      );
      validateAssignedRoomCapacity(item, [room]);
      item.assignedRooms = [buildRoomSnapshot(room)];
      assignedRoomIds.add(String(room._id));
      continue;
    }

    if (explicitRoomIds.length > 0) {
      if (new Set(explicitRoomIds.map(String)).size !== explicitRoomIds.length) {
        throw new AppError("The same room cannot be assigned twice to one booking", 400);
      }

      if (explicitRoomIds.length !== item.roomCount) {
        throw new AppError(`Select exactly ${item.roomCount} room(s) for ${item.roomType}`, 400);
      }

      const snapshots = await hydrateAssignedRoomSnapshots(explicitRoomIds, { session });
      const rooms = await Room.find({ _id: { $in: explicitRoomIds }, status: "active" })
        .session(session || null);

      for (const room of rooms) {
        if (room.roomType !== item.roomType) {
          throw new AppError("Selected room does not match booking room type", 400);
        }

        if (assignedRoomIds.has(String(room._id))) {
          throw new AppError("The same room cannot be assigned twice to one booking", 400);
        }

        await assertRoomAvailable(
          { roomId: room._id, checkIn, checkOut, excludeBookingId },
          { session }
        );
        assignedRoomIds.add(String(room._id));
      }

      validateAssignedRoomCapacity(item, rooms);
      item.assignedRooms = snapshots;
      continue;
    }

    const rooms = await findAvailableRoomsByType(
      {
        roomType: item.roomType,
        checkIn,
        checkOut,
        count: item.roomCount,
        excludeRoomIds: [...assignedRoomIds],
        excludeBookingId
      },
      { session }
    );

    validateAssignedRoomCapacity(item, rooms);
    item.assignedRooms = rooms.map(buildRoomSnapshot);
    rooms.forEach((room) => assignedRoomIds.add(String(room._id)));
  }

  return roomItems;
};

const buildManualBookingData = async (
  payload,
  { session, excludeBookingId, fallbackBooking } = {}
) => {
  const { startDate, endDate } = validateDateRange(
    payload.checkIn || fallbackBooking?.checkIn,
    payload.checkOut || fallbackBooking?.checkOut
  );
  const bookingStatus = payload.bookingStatus || fallbackBooking?.bookingStatus || "pending_payment";
  const paymentStatus = payload.paymentStatus || fallbackBooking?.paymentStatus || "unpaid";

  validateEditableEnums({ bookingStatus, paymentStatus });

  const nights = getNights(startDate, endDate);
  const requestedRoomItems = normalizeRoomItemsPayload(payload.roomItems ? payload : fallbackBooking);
  const pricedRoomItems = await buildPricedRoomItems(requestedRoomItems, { nights, session });
  const assignedRoomItems = await assignManualRoomItems(pricedRoomItems, payload, {
    checkIn: startDate,
    checkOut: endDate,
    session,
    excludeBookingId
  });
  const numberOfGuests = assignedRoomItems.reduce((total, item) => total + item.adultGuests, 0);
  const numberOfChildren = assignedRoomItems.reduce((total, item) => total + item.childGuests, 0);
  const numberOfRooms = assignedRoomItems.reduce((total, item) => total + item.roomCount, 0);
  const firstAssignedRoom = assignedRoomItems
    .flatMap((item) => item.assignedRooms || [])
    .find((room) => room.roomId);
  const primaryRoomType = assignedRoomItems[0]?.roomType;
  const subtotalAmount = assignedRoomItems.reduce((total, item) => total + item.subtotal, 0);
  const promoId = payload.promoId === undefined ? fallbackBooking?.promoId : payload.promoId;
  let promo = null;

  if (payload.promoId === undefined && fallbackBooking?.promoId) {
    promo = {
      _id: fallbackBooking.promoId,
      name: fallbackBooking.promoName || "",
      adjustmentType: fallbackBooking.promoAdjustmentType || "",
      adjustmentValue: fallbackBooking.promoAdjustmentValue || 0
    };
  } else if (promoId) {
    promo = await getActivePromo(promoId, {
      session,
      nights,
      roomTypes: assignedRoomItems.map((item) => item.roomType),
      totalRooms: numberOfRooms
    });
  }
  const calculatedTotal = promo
    ? Math.max(0, Math.round(applyPromoPricing(subtotalAmount, promo)))
    : subtotalAmount;
  const totalAmount = payload.overrideTotal
    ? validatePositiveNumber(payload.totalAmount ?? calculatedTotal, "totalAmount", true)
    : calculatedTotal;
  const source = await resolveManualBookingSource(
    {
      ...payload,
      source: payload.source ?? fallbackBooking?.source,
      sourceName: payload.sourceName ?? fallbackBooking?.sourceName
    },
    { session }
  );

  return {
    startDate,
    endDate,
    bookingStatus,
    paymentStatus,
    assignedRoomItems,
    numberOfGuests,
    numberOfChildren,
    numberOfRooms,
    firstAssignedRoom,
    primaryRoomType,
    totalAmount,
    promo,
    source
  };
};

const upsertManualPayment = async ({ booking, paymentStatus, adminNote, session }) => {
  if (paymentStatus !== "paid") {
    return null;
  }

  let payment = booking.paymentId
    ? await Payment.findById(booking.paymentId).session(session || null)
    : null;

  if (!payment) {
    payment = await Payment.findOne({ bookingId: booking._id })
      .sort({ createdAt: -1 })
      .session(session || null);
  }

  if (!payment) {
    return createManualPayment({
      booking,
      paymentStatus,
      adminNote,
      session
    });
  }

  payment.amount = booking.totalAmount;
  payment.paymentMethod = payment.paymentMethod || "other";
  payment.paymentStatus = "paid";
  payment.adminNote = adminNote || payment.adminNote || "Updated from admin booking edit";
  payment.approvedBy = payment.approvedBy || "system-admin";
  payment.approvedAt = payment.approvedAt || new Date();
  payment.rejectedAt = null;

  await payment.save(sessionOption(session));

  return payment;
};

const syncSuccessfulBookingSideEffects = async ({ booking, payment, session }) => {
  await cancelCalendarEventByBooking(booking._id, { session });

  const calendarEvent = await createCalendarEventForBooking(booking, {
    session,
    availabilityMessage:
      "Cannot update booking because one or more selected rooms are no longer available."
  });
  const invoice = await syncInvoiceForBooking(booking, payment, { session });

  booking.calendarEventId = calendarEvent._id;
  booking.calendarEventIds = calendarEvent.calendarEventIds || [calendarEvent._id];
  booking.invoiceId = invoice._id;
  booking.paymentId = payment._id;

  await booking.save(sessionOption(session));

  return { calendarEvent, invoice };
};

const cancelConfirmedSideEffects = async (booking, { session } = {}) => {
  await cancelCalendarEventByBooking(booking._id, { session });
  await Invoice.updateMany(
    { bookingId: booking._id, invoiceStatus: "paid" },
    { invoiceStatus: "cancelled" },
    sessionOption(session) || {}
  );

  booking.calendarEventId = null;
  booking.calendarEventIds = [];
};

const createManualBooking = async (payload, { approvedBy } = {}) => {
  let invoiceIdToEmail = null;

  const result = await runWithOptionalTransaction(async (session) => {
    const { startDate, endDate } = validateDateRange(payload.checkIn, payload.checkOut);
    const bookingStatus = payload.bookingStatus || "pending_payment";
    const paymentStatus = payload.paymentStatus || "unpaid";
    validateManualEnums({ bookingStatus, paymentStatus });

    const nights = getNights(startDate, endDate);
    const requestedRoomItems = normalizeRoomItemsPayload(payload);
    const pricedRoomItems = await buildPricedRoomItems(requestedRoomItems, { nights, session });
    const assignedRoomItems = await assignManualRoomItems(pricedRoomItems, payload, {
      checkIn: startDate,
      checkOut: endDate,
      session
    });
    const numberOfGuests = assignedRoomItems.reduce((total, item) => total + item.adultGuests, 0);
    const numberOfChildren = assignedRoomItems.reduce((total, item) => total + item.childGuests, 0);
    const numberOfRooms = assignedRoomItems.reduce((total, item) => total + item.roomCount, 0);
    const firstAssignedRoom = assignedRoomItems
      .flatMap((item) => item.assignedRooms || [])
      .find((room) => room.roomId);
    const primaryRoomType = assignedRoomItems[0]?.roomType;
    const subtotalAmount = assignedRoomItems.reduce((total, item) => total + item.subtotal, 0);
    const promo = payload.promoId
      ? await getActivePromo(payload.promoId, {
          session,
          nights,
          roomTypes: assignedRoomItems.map((item) => item.roomType),
          totalRooms: numberOfRooms
        })
      : null;
    const calculatedTotal = promo
      ? Math.max(0, Math.round(applyPromoPricing(subtotalAmount, promo)))
      : subtotalAmount;
    const totalAmount = payload.overrideTotal
      ? validatePositiveNumber(payload.totalAmount ?? calculatedTotal, "totalAmount", true)
      : calculatedTotal;
    const source = await resolveManualBookingSource(payload, { session });

    const [booking] = await Booking.create(
      [
        {
          guestName: payload.guestName,
          guestEmail: payload.guestEmail || "",
          guestPhone: payload.guestPhone,
          propertyId: payload.propertyId || "the-forest-cabin",
          roomId: firstAssignedRoom?.roomId || null,
          roomType: primaryRoomType,
          checkIn: startDate,
          checkOut: endDate,
          numberOfGuests,
          numberOfChildren,
          numberOfRooms,
          roomItems: assignedRoomItems,
          totalAmount,
          promoId: promo?._id || null,
          promoName: promo?.name || "",
          promoAdjustmentType: promo?.adjustmentType || "",
          promoAdjustmentValue: promo?.adjustmentValue || 0,
          source: source.source,
          sourceName: source.sourceName,
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
      booking.calendarEventIds = calendarEvent.calendarEventIds || [calendarEvent._id];
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

const updateManualBooking = async (bookingId, payload, { approvedBy } = {}) => {
  validateObjectId(bookingId, "booking id");

  const result = await runWithOptionalTransaction(async (session) => {
    const booking = await Booking.findById(bookingId).session(session || null);

    if (!booking) {
      throw new AppError("Booking not found", 404);
    }

    if (booking.bookingStatus === "cancelled") {
      throw new AppError("Cancelled bookings cannot be edited", 409);
    }

    const bookingData = await buildManualBookingData(payload, {
      session,
      excludeBookingId: booking._id,
      fallbackBooking: booking
    });

    const guestName = payload.guestName ?? booking.guestName;
    const guestEmail = payload.guestEmail ?? booking.guestEmail;
    const guestPhone = payload.guestPhone ?? booking.guestPhone;

    booking.guestName = guestName;
    booking.guestEmail = guestEmail || "";
    booking.guestPhone = guestPhone;
    booking.propertyId = payload.propertyId || booking.propertyId || "the-forest-cabin";
    booking.roomId = bookingData.firstAssignedRoom?.roomId || null;
    booking.roomType = bookingData.primaryRoomType;
    booking.checkIn = bookingData.startDate;
    booking.checkOut = bookingData.endDate;
    booking.numberOfGuests = bookingData.numberOfGuests;
    booking.numberOfChildren = bookingData.numberOfChildren;
    booking.numberOfRooms = bookingData.numberOfRooms;
    booking.roomItems = bookingData.assignedRoomItems;
    booking.totalAmount = bookingData.totalAmount;
    booking.promoId = bookingData.promo?._id || null;
    booking.promoName = bookingData.promo?.name || "";
    booking.promoAdjustmentType = bookingData.promo?.adjustmentType || "";
    booking.promoAdjustmentValue = bookingData.promo?.adjustmentValue || 0;
    booking.source = bookingData.source.source;
    booking.sourceName = bookingData.source.sourceName;
    booking.bookingStatus = bookingData.bookingStatus;
    booking.paymentStatus = bookingData.paymentStatus;
    booking.adminNote = payload.adminNote ?? booking.adminNote;
    booking.approvedAt = bookingData.bookingStatus === "success"
      ? booking.approvedAt || new Date()
      : booking.approvedAt;
    booking.updatedBy = approvedBy || booking.updatedBy;

    await booking.save(sessionOption(session));

    const payment = await upsertManualPayment({
      booking,
      paymentStatus: bookingData.paymentStatus,
      adminNote: payload.adminNote,
      session
    });

    if (payment) {
      booking.paymentId = payment._id;
    }

    if (bookingData.bookingStatus === "success") {
      await syncSuccessfulBookingSideEffects({ booking, payment, session });
    } else {
      await cancelConfirmedSideEffects(booking, { session });
      await booking.save(sessionOption(session));
    }

    return Booking.findById(booking._id)
      .populate("roomId")
      .populate("paymentId")
      .populate("invoiceId")
      .populate("calendarEventId")
      .populate("calendarEventIds")
      .session(session || null);
  });

  return Booking.findById(result._id)
    .populate("roomId")
    .populate("paymentId")
    .populate("invoiceId")
    .populate("calendarEventId")
    .populate("calendarEventIds");
};

module.exports = {
  createManualBooking,
  updateManualBooking,
  manualBookingStatuses,
  manualPaymentStatuses
};
