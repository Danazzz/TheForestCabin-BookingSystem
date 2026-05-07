const Booking = require("../models/Booking");
const Invoice = require("../models/Invoice");
const Room = require("../models/Room");
const mongoose = require("mongoose");
const AppError = require("../utils/AppError");
const { parseDate } = require("../utils/validators");
const {
  SMTP_DAILY_LIMIT_WARNING_CODE,
  getSmtpDailyLimit
} = require("./emailService");

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DEFAULT_DATABASE_STORAGE_LIMIT_MB = 512;
const DEFAULT_DATABASE_WARNING_PERCENT = 80;

const addDays = (date, days) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const startOfUtcDay = (date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const toDateOnly = (date) => date.toISOString().slice(0, 10);

const getDefaultRange = () => {
  const now = new Date();
  const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

  return { startDate, endDate };
};

const parseDashboardRange = ({ startDate: startValue, endDate: endValue }) => {
  const defaults = getDefaultRange();
  const startDate = startValue
    ? startOfUtcDay(parseDate(startValue, "startDate"))
    : defaults.startDate;
  const endDateInclusive = endValue
    ? startOfUtcDay(parseDate(endValue, "endDate"))
    : defaults.endDate;

  if (startDate > endDateInclusive) {
    throw new AppError("endDate must be the same as or later than startDate", 400);
  }

  const endDateExclusive = addDays(endDateInclusive, 1);
  const nights = Math.ceil((endDateExclusive.getTime() - startDate.getTime()) / MS_PER_DAY);

  return {
    startDate,
    endDateInclusive,
    endDateExclusive,
    nights
  };
};

const getNights = (startDate, endDate) =>
  Math.max(0, Math.ceil((endDate.getTime() - startDate.getTime()) / MS_PER_DAY));

const getOverlapNights = (booking, range) => {
  const bookingStart = new Date(booking.checkIn);
  const bookingEnd = new Date(booking.checkOut);
  const overlapStart = bookingStart > range.startDate ? bookingStart : range.startDate;
  const overlapEnd =
    bookingEnd < range.endDateExclusive ? bookingEnd : range.endDateExclusive;

  return getNights(overlapStart, overlapEnd);
};

const formatRoomType = (roomType) =>
  String(roomType || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const buildRoomTypeBreakdown = (rooms, range) => {
  const roomTypes = new Map();

  rooms.forEach((room) => {
    const key = room.roomType;
    const current =
      roomTypes.get(key) || {
        roomType: key,
        label: formatRoomType(key),
        roomCount: 0,
        availableRoomNights: 0,
        bookedRoomNights: 0,
        revenue: 0,
        bookingCount: 0
      };

    current.roomCount += 1;
    current.availableRoomNights += range.nights;
    roomTypes.set(key, current);
  });

  return roomTypes;
};

const incrementSourceBreakdown = (sourceBreakdown, booking, { roomNights, revenue }) => {
  const source = booking.source || "unknown";
  const current =
    sourceBreakdown.get(source) || {
      source,
      sourceName: booking.sourceName || formatRoomType(source),
      bookingCount: 0,
      bookedRoomNights: 0,
      revenue: 0
    };

  if (booking.sourceName && current.sourceName !== booking.sourceName) {
    current.sourceName = booking.sourceName;
  }

  current.bookingCount += 1;
  current.bookedRoomNights += roomNights;
  current.revenue += revenue;
  sourceBreakdown.set(source, current);
};

const finalizeRoomTypeBreakdown = (roomTypes) =>
  Array.from(roomTypes.values())
    .map((item) => ({
      ...item,
      revenue: Math.round(item.revenue),
      occupancyRate: item.availableRoomNights
        ? Number(((item.bookedRoomNights / item.availableRoomNights) * 100).toFixed(1))
        : 0
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

const finalizeSourceBreakdown = (sourceBreakdown) =>
  Array.from(sourceBreakdown.values())
    .map((item) => ({
      ...item,
      revenue: Math.round(item.revenue)
    }))
    .sort((a, b) => b.revenue - a.revenue || a.sourceName.localeCompare(b.sourceName));

const isLimitWarning = (value) =>
  String(value || "").includes(SMTP_DAILY_LIMIT_WARNING_CODE);

const getEmailWarningSummary = async () => {
  const now = new Date();
  const startDate = startOfUtcDay(now);
  const endDate = addDays(startDate, 1);
  const [bookingEmails, invoiceEmails] = await Promise.all([
    Booking.find({
      emailLastAttemptedAt: { $gte: startDate, $lt: endDate },
      emailDeliveryStatus: { $in: ["sent", "failed", "not_configured"] }
    }).select("emailDeliveryStatus emailDeliveryError emailLastAttemptedAt bookingCode"),
    Invoice.find({
      updatedAt: { $gte: startDate, $lt: endDate },
      emailStatus: { $in: ["sent", "failed", "not_configured"] }
    }).select("emailStatus emailError emailedAt updatedAt invoiceNumber")
  ]);
  const failedBookingEmails = bookingEmails.filter((booking) =>
    ["failed", "not_configured"].includes(booking.emailDeliveryStatus)
  );
  const failedInvoiceEmails = invoiceEmails.filter((invoice) =>
    ["failed", "not_configured"].includes(invoice.emailStatus)
  );
  const limitFailures = [
    ...failedBookingEmails.filter((booking) => isLimitWarning(booking.emailDeliveryError)),
    ...failedInvoiceEmails.filter((invoice) => isLimitWarning(invoice.emailError))
  ];
  const lastFailure = [...failedBookingEmails, ...failedInvoiceEmails]
    .sort((a, b) => {
      const aDate = new Date(a.emailLastAttemptedAt || a.updatedAt || 0).getTime();
      const bDate = new Date(b.emailLastAttemptedAt || b.updatedAt || 0).getTime();

      return bDate - aDate;
    })[0];

  return {
    smtpDailyLimit: getSmtpDailyLimit(),
    sentToday:
      bookingEmails.filter((booking) => booking.emailDeliveryStatus === "sent").length +
      invoiceEmails.filter((invoice) => invoice.emailStatus === "sent").length,
    failedToday: failedBookingEmails.length + failedInvoiceEmails.length,
    limitFailuresToday: limitFailures.length,
    smtpLimitReached: limitFailures.length > 0,
    lastError: lastFailure?.emailDeliveryError || lastFailure?.emailError || ""
  };
};

const getNumberFromEnv = (key, fallback) => {
  const value = Number(process.env[key]);

  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const getDatabaseUsageSummary = async () => {
  const storageLimitMb = getNumberFromEnv(
    "DATABASE_STORAGE_LIMIT_MB",
    DEFAULT_DATABASE_STORAGE_LIMIT_MB
  );
  const warningPercent = Math.min(
    100,
    getNumberFromEnv("DATABASE_STORAGE_WARNING_PERCENT", DEFAULT_DATABASE_WARNING_PERCENT)
  );
  const storageLimitBytes = storageLimitMb * 1024 * 1024;

  try {
    if (!mongoose.connection?.db) {
      throw new Error("MongoDB connection is not ready");
    }

    const stats = await mongoose.connection.db.stats();
    const usedBytes = Number(stats.storageSize || stats.dataSize || 0);
    const dataSizeBytes = Number(stats.dataSize || 0);
    const indexSizeBytes = Number(stats.indexSize || 0);
    const usagePercent = storageLimitBytes
      ? Number(((usedBytes / storageLimitBytes) * 100).toFixed(1))
      : 0;

    return {
      available: true,
      databaseName: stats.db || mongoose.connection.name || "",
      storageLimitMb,
      warningPercent,
      usedBytes,
      usedMb: Number((usedBytes / 1024 / 1024).toFixed(2)),
      dataSizeMb: Number((dataSizeBytes / 1024 / 1024).toFixed(2)),
      indexSizeMb: Number((indexSizeBytes / 1024 / 1024).toFixed(2)),
      usagePercent,
      isNearLimit: usagePercent >= warningPercent,
      objectCount: Number(stats.objects || 0),
      collectionCount: Number(stats.collections || 0)
    };
  } catch (error) {
    return {
      available: false,
      storageLimitMb,
      warningPercent,
      usedBytes: 0,
      usedMb: 0,
      dataSizeMb: 0,
      indexSizeMb: 0,
      usagePercent: 0,
      isNearLimit: false,
      error: error.message
    };
  }
};

const getDashboardSummary = async ({ startDate, endDate } = {}) => {
  const range = parseDashboardRange({ startDate, endDate });
  const [rooms, overlappingBookings, emailWarnings, databaseUsage] = await Promise.all([
    Room.find({ status: "active" }).sort({ roomType: 1, roomNumber: 1 }),
    Booking.find({
      checkIn: { $lt: range.endDateExclusive },
      checkOut: { $gt: range.startDate },
      bookingStatus: {
        $in: [
          "waiting_availability_approval",
          "pending_payment",
          "waiting_admin_approval",
          "success"
        ]
      }
    })
      .populate("roomId")
      .sort({ checkIn: 1 }),
    getEmailWarningSummary(),
    getDatabaseUsageSummary()
  ]);

  const roomTypeBreakdown = buildRoomTypeBreakdown(rooms, range);
  const sourceBreakdown = new Map();
  const statusCounts = {
    waitingAvailabilityApproval: 0,
    waitingAdminApproval: 0,
    pendingPayment: 0,
    rejected: 0,
    cancelled: 0
  };
  let confirmedBookingCount = 0;
  let confirmedRoomNights = 0;
  let revenue = 0;
  let potentialRevenue = 0;

  overlappingBookings.forEach((booking) => {
    const overlapNights = getOverlapNights(booking, range);

    if (overlapNights <= 0) {
      return;
    }

    const bookingNights = getNights(new Date(booking.checkIn), new Date(booking.checkOut));
    const proratedAmount = bookingNights
      ? (Number(booking.totalAmount || 0) * overlapNights) / bookingNights
      : 0;

    if (booking.bookingStatus === "success" && booking.paymentStatus === "paid") {
      confirmedBookingCount += 1;
      confirmedRoomNights += overlapNights;
      revenue += proratedAmount;

      const roomType = booking.roomId?.roomType || booking.roomType;
      const current = roomTypeBreakdown.get(roomType);

      if (current) {
        current.bookedRoomNights += overlapNights;
        current.revenue += proratedAmount;
        current.bookingCount += 1;
      }

      incrementSourceBreakdown(sourceBreakdown, booking, {
        roomNights: overlapNights,
        revenue: proratedAmount
      });
    } else if (
      ["pending_payment", "waiting_admin_approval", "waiting_availability_approval"].includes(
        booking.bookingStatus
      )
    ) {
      potentialRevenue += proratedAmount;

      if (booking.bookingStatus === "waiting_availability_approval") {
        statusCounts.waitingAvailabilityApproval += 1;
      }

      if (booking.bookingStatus === "waiting_admin_approval") {
        statusCounts.waitingAdminApproval += 1;
      }

      if (booking.bookingStatus === "pending_payment") {
        statusCounts.pendingPayment += 1;
      }
    }
  });

  const totalRoomNights = rooms.length * range.nights;
  const occupancyRate = totalRoomNights
    ? Number(((confirmedRoomNights / totalRoomNights) * 100).toFixed(1))
    : 0;

  return {
    range: {
      startDate: toDateOnly(range.startDate),
      endDate: toDateOnly(range.endDateInclusive),
      nights: range.nights
    },
    totals: {
      revenue: Math.round(revenue),
      potentialRevenue: Math.round(potentialRevenue),
      occupancyRate,
      confirmedBookings: confirmedBookingCount,
      confirmedRoomNights,
      totalRoomNights,
      activeRooms: rooms.length,
      ...statusCounts
    },
    breakdowns: {
      byRoomType: finalizeRoomTypeBreakdown(roomTypeBreakdown),
      bySource: finalizeSourceBreakdown(sourceBreakdown)
    },
    emailWarnings,
    databaseUsage
  };
};

module.exports = {
  getDashboardSummary,
  parseDashboardRange,
  getOverlapNights,
  getDatabaseUsageSummary
};
