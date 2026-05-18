const Booking = require("../models/Booking");
const Invoice = require("../models/Invoice");
const {
  getDashboardSummary,
  getOverlapNights,
  parseDashboardRange
} = require("./dashboardSummaryService");
const { getAssignedRoomsFromBooking, getRoomItemsFromBooking } = require("./bookingRoomItemsService");

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const toDateOnly = (date) => new Date(date).toISOString().slice(0, 10);

const formatDateTime = (date) => {
  if (!date) {
    return "";
  }

  return new Date(date).toISOString();
};

const getNights = (startDate, endDate) =>
  Math.max(0, Math.ceil((endDate.getTime() - startDate.getTime()) / MS_PER_DAY));

const escapeCsvValue = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = value instanceof Date
    ? formatDateTime(value)
    : String(value);

  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
};

const buildCsvRows = (rows) =>
  rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n");

const appendSectionTitle = (sections, title) => {
  if (sections.length) {
    sections.push([]);
  }

  sections.push([title]);
};

const appendTable = (sections, title, headers, rows) => {
  appendSectionTitle(sections, title);
  sections.push(headers);
  rows.forEach((row) => sections.push(row));
};

const normalizeFilenamePart = (value) =>
  String(value || "")
    .replace(/[^a-z0-9-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

const buildFilename = (prefix, range) =>
  `${prefix}-${normalizeFilenamePart(toDateOnly(range.startDate))}-to-${normalizeFilenamePart(
    toDateOnly(range.endDateInclusive)
  )}.csv`;

const getProratedAmount = (booking, overlapNights) => {
  const bookingNights = getNights(new Date(booking.checkIn), new Date(booking.checkOut));

  if (!bookingNights) {
    return 0;
  }

  return (Number(booking.totalAmount || 0) * overlapNights) / bookingNights;
};

const isOccupancyBooking = (booking) =>
  booking.bookingStatus === "success" && booking.paymentStatus === "paid";

const isPotentialIncomeBooking = (booking) =>
  ["waiting_availability_approval", "pending_payment", "waiting_admin_approval"].includes(
    booking.bookingStatus
  );

const buildBookingsOccupancyCsv = async ({ startDate, endDate } = {}) => {
  const range = parseDashboardRange({ startDate, endDate });
  const [summary, bookings] = await Promise.all([
    getDashboardSummary({ startDate, endDate }),
    Booking.find({
      checkIn: { $lt: range.endDateExclusive },
      checkOut: { $gt: range.startDate }
    })
      .populate("roomId")
      .populate("invoiceId")
      .populate("paymentId")
      .sort({ checkIn: 1, roomType: 1, createdAt: 1 })
  ]);

  const sections = [];
  const totals = summary.totals || {};
  const rangeSummary = summary.range || {};

  appendTable(
    sections,
    "Export Summary",
    ["Field", "Value"],
    [
      ["Generated at", formatDateTime(new Date())],
      ["Stay range start", rangeSummary.startDate],
      ["Stay range end", rangeSummary.endDate],
      ["Range nights", rangeSummary.nights],
      ["Active rooms", totals.activeRooms || 0],
      ["Total room nights", totals.totalRoomNights || 0],
      ["Confirmed room nights", totals.confirmedRoomNights || 0],
      ["Occupancy rate", `${totals.occupancyRate || 0}%`],
      ["Confirmed paid income", totals.revenue || 0],
      ["Potential income", totals.potentialRevenue || 0],
      ["Confirmed bookings", totals.confirmedBookings || 0],
      ["Waiting availability approval", totals.waitingAvailabilityApproval || 0],
      ["Pending payment", totals.pendingPayment || 0],
      ["Waiting payment approval", totals.waitingAdminApproval || 0]
    ]
  );

  appendTable(
    sections,
    "Bookings",
    [
      "Booking code",
      "Guest name",
      "Guest email",
      "Guest phone",
      "Room number",
      "Room name",
      "Room type",
      "Check in",
      "Check out",
      "Total stay nights",
      "Overlap nights in range",
      "Adults",
      "Children",
      "Booking status",
      "Payment status",
      "Source",
      "Source name",
      "Promo",
      "Total amount",
      "Prorated amount in range",
      "Counts as occupancy",
      "Income counted",
      "Potential income counted",
      "Invoice number",
      "Payment method",
      "Payment due at",
      "Created at",
      "Updated at",
      "Admin note"
    ],
    bookings.map((booking) => {
      const overlapNights = getOverlapNights(booking, range);
      const totalStayNights = getNights(new Date(booking.checkIn), new Date(booking.checkOut));
      const proratedAmount = Math.round(getProratedAmount(booking, overlapNights));
      const countsAsOccupancy = isOccupancyBooking(booking);
      const countsAsPotentialIncome = isPotentialIncomeBooking(booking);
      const assignedRooms = getAssignedRoomsFromBooking(booking);
      const roomItems = getRoomItemsFromBooking(booking);
      const room = booking.roomId || {};
      const invoice = booking.invoiceId || {};
      const payment = booking.paymentId || {};

      return [
        booking.bookingCode,
        booking.guestName,
        booking.guestEmail,
        booking.guestPhone,
        assignedRooms.map((assignedRoom) => assignedRoom.roomNumber).filter(Boolean).join(", ") || room.roomNumber || "",
        assignedRooms.map((assignedRoom) => assignedRoom.name).filter(Boolean).join(", ") || room.name || "",
        roomItems.map((item) => `${item.roomCount || 1}x ${item.roomType}`).join(", ") || room.roomType || booking.roomType,
        toDateOnly(booking.checkIn),
        toDateOnly(booking.checkOut),
        totalStayNights,
        overlapNights,
        booking.numberOfGuests,
        booking.numberOfChildren || 0,
        booking.bookingStatus,
        booking.paymentStatus,
        booking.source,
        booking.sourceName,
        booking.promoName,
        booking.totalAmount,
        proratedAmount,
        countsAsOccupancy ? "yes" : "no",
        countsAsOccupancy ? proratedAmount : 0,
        countsAsPotentialIncome ? proratedAmount : 0,
        invoice.invoiceNumber || "",
        payment.paymentMethod || "",
        formatDateTime(booking.paymentDueAt),
        formatDateTime(booking.createdAt),
        formatDateTime(booking.updatedAt),
        booking.adminNote || ""
      ];
    })
  );

  appendTable(
    sections,
    "Room Type Occupancy",
    [
      "Room type",
      "Rooms",
      "Available room nights",
      "Booked room nights",
      "Occupancy rate",
      "Confirmed paid income",
      "Confirmed bookings"
    ],
    (summary.breakdowns?.byRoomType || []).map((item) => [
      item.label,
      item.roomCount,
      item.availableRoomNights,
      item.bookedRoomNights,
      `${item.occupancyRate || 0}%`,
      item.revenue,
      item.bookingCount
    ])
  );

  appendTable(
    sections,
    "Income By Source",
    ["Source", "Bookings", "Room nights", "Confirmed paid income"],
    (summary.breakdowns?.bySource || []).map((item) => [
      item.sourceName,
      item.bookingCount,
      item.bookedRoomNights,
      item.revenue
    ])
  );

  return {
    filename: buildFilename("bookings-occupancy", range),
    csv: buildCsvRows(sections)
  };
};

const buildIncomeSummary = (invoices) => {
  const byPaymentMethod = new Map();
  const bySource = new Map();
  let paidInvoiceCount = 0;
  let cancelledInvoiceCount = 0;
  let paidIncome = 0;
  let cancelledAmount = 0;

  invoices.forEach((invoice) => {
    const isPaid = invoice.invoiceStatus === "paid";
    const amount = Number(invoice.totalAmount || 0);
    const booking = invoice.bookingId || {};
    const source = booking.source || "unknown";
    const sourceName = booking.sourceName || source;

    if (isPaid) {
      paidInvoiceCount += 1;
      paidIncome += amount;
    } else if (invoice.invoiceStatus === "cancelled") {
      cancelledInvoiceCount += 1;
      cancelledAmount += amount;
    }

    const paymentCurrent =
      byPaymentMethod.get(invoice.paymentMethod) || {
        paymentMethod: invoice.paymentMethod,
        paidInvoiceCount: 0,
        income: 0
      };
    const sourceCurrent =
      bySource.get(source) || {
        source,
        sourceName,
        paidInvoiceCount: 0,
        income: 0
      };

    if (isPaid) {
      paymentCurrent.paidInvoiceCount += 1;
      paymentCurrent.income += amount;
      sourceCurrent.paidInvoiceCount += 1;
      sourceCurrent.income += amount;
    }

    byPaymentMethod.set(invoice.paymentMethod, paymentCurrent);
    bySource.set(source, sourceCurrent);
  });

  return {
    totals: {
      invoiceCount: invoices.length,
      paidInvoiceCount,
      cancelledInvoiceCount,
      paidIncome: Math.round(paidIncome),
      cancelledAmount: Math.round(cancelledAmount)
    },
    byPaymentMethod: Array.from(byPaymentMethod.values()).sort((a, b) =>
      a.paymentMethod.localeCompare(b.paymentMethod)
    ),
    bySource: Array.from(bySource.values()).sort(
      (a, b) => b.income - a.income || a.sourceName.localeCompare(b.sourceName)
    )
  };
};

const buildInvoicesIncomeCsv = async ({ startDate, endDate } = {}) => {
  const range = parseDashboardRange({ startDate, endDate });
  const invoices = await Invoice.find({
    issuedAt: { $gte: range.startDate, $lt: range.endDateExclusive }
  })
    .populate("bookingId")
    .sort({ issuedAt: 1, invoiceNumber: 1 });
  const summary = buildIncomeSummary(invoices);
  const sections = [];

  appendTable(
    sections,
    "Export Summary",
    ["Field", "Value"],
    [
      ["Generated at", formatDateTime(new Date())],
      ["Invoice issued start", toDateOnly(range.startDate)],
      ["Invoice issued end", toDateOnly(range.endDateInclusive)],
      ["Invoice count", summary.totals.invoiceCount],
      ["Paid invoice count", summary.totals.paidInvoiceCount],
      ["Cancelled invoice count", summary.totals.cancelledInvoiceCount],
      ["Paid income", summary.totals.paidIncome],
      ["Cancelled amount", summary.totals.cancelledAmount]
    ]
  );

  appendTable(
    sections,
    "Invoices",
    [
      "Invoice number",
      "Booking code",
      "Guest name",
      "Guest email",
      "Room number",
      "Room type",
      "Check in",
      "Check out",
      "Payment method",
      "Invoice status",
      "Email status",
      "Subtotal",
      "Total amount",
      "Issued at",
      "Emailed at",
      "Booking source",
      "Booking source name",
      "Booking status",
      "Payment status"
    ],
    invoices.map((invoice) => {
      const booking = invoice.bookingId || {};

      return [
        invoice.invoiceNumber,
        booking.bookingCode || "",
        invoice.guestName,
        invoice.guestEmail,
        invoice.roomNumber,
        invoice.roomType,
        toDateOnly(invoice.checkIn),
        toDateOnly(invoice.checkOut),
        invoice.paymentMethod,
        invoice.invoiceStatus,
        invoice.emailStatus,
        invoice.subtotal,
        invoice.totalAmount,
        formatDateTime(invoice.issuedAt),
        formatDateTime(invoice.emailedAt),
        booking.source || "",
        booking.sourceName || "",
        booking.bookingStatus || "",
        booking.paymentStatus || ""
      ];
    })
  );

  appendTable(
    sections,
    "Income By Payment Method",
    ["Payment method", "Paid invoices", "Income"],
    summary.byPaymentMethod.map((item) => [
      item.paymentMethod,
      item.paidInvoiceCount,
      Math.round(item.income)
    ])
  );

  appendTable(
    sections,
    "Income By Source",
    ["Source", "Paid invoices", "Income"],
    summary.bySource.map((item) => [
      item.sourceName,
      item.paidInvoiceCount,
      Math.round(item.income)
    ])
  );

  return {
    filename: buildFilename("invoices-income", range),
    csv: buildCsvRows(sections)
  };
};

module.exports = {
  buildBookingsOccupancyCsv,
  buildInvoicesIncomeCsv
};
