const Invoice = require("../models/Invoice");
const Room = require("../models/Room");
const AppError = require("../utils/AppError");
const {
  getAssignedRoomsFromBooking,
  getNights,
  getRoomItemsFromBooking
} = require("./bookingRoomItemsService");
const {
  getInvoiceSettings,
  sanitizeInvoicePrefix,
  buildInvoiceSettingsSnapshot
} = require("./invoiceSettingsService");

const sessionOption = (session) => (session ? { session } : undefined);

const generateInvoiceNumber = async ({ session, prefix = "INV" } = {}) => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const invoicePrefix = sanitizeInvoicePrefix(prefix);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
    const invoiceNumber = `${invoicePrefix}-${datePart}-${randomPart}`;
    const existingInvoice = await Invoice.findOne({ invoiceNumber }).session(session || null);

    if (!existingInvoice) {
      return invoiceNumber;
    }
  }

  return `${invoicePrefix}-${datePart}-${Date.now()}`;
};

const generateInvoiceForBooking = async (booking, payment, { session } = {}) => {
  const existingInvoice = await Invoice.findOne({ bookingId: booking._id }).session(
    session || null
  );

  if (existingInvoice) {
    return existingInvoice;
  }

  const assignedRooms = getAssignedRoomsFromBooking(booking);
  const roomItems = getRoomItemsFromBooking(booking);

  if (assignedRooms.length === 0 && !booking.roomId) {
    throw new AppError("Room not found for invoice generation", 404);
  }

  const fallbackRoom = booking.roomId
    ? await Room.findById(booking.roomId).session(session || null)
    : null;
  const nights = getNights(booking.checkIn, booking.checkOut);
  const subtotal = roomItems.reduce(
    (total, item) => total + (item.subtotal || (item.basePrice || 0) * (item.roomCount || 1) * nights),
    0
  ) || booking.totalAmount;
  const settings = await getInvoiceSettings({ session });
  const settingsSnapshot = buildInvoiceSettingsSnapshot(settings);
  const dateRange = `${booking.checkIn.toISOString().slice(0, 10)} to ${booking.checkOut.toISOString().slice(0, 10)}`;
  const items = roomItems.map((item) => {
    const roomNumbers = (item.assignedRooms || [])
      .map((room) => room.roomNumber)
      .filter(Boolean)
      .join(", ");
    const roomLabel = roomNumbers ? ` rooms ${roomNumbers}` : "";
    const quantity = Math.max((item.roomCount || 1) * nights, 1);
    const unitPrice = item.basePrice || 0;

    return {
      description: `${item.roomType}${roomLabel} (${dateRange})`,
      quantity,
      unitPrice,
      amount: item.subtotal || unitPrice * quantity
    };
  });

  if (items.length === 0 && fallbackRoom) {
    items.push({
      description: `${fallbackRoom.name} ${fallbackRoom.roomNumber} (${dateRange})`,
      quantity: 1,
      unitPrice: booking.totalAmount,
      amount: booking.totalAmount
    });
  }

  const roomTypeSummary = [...new Set(roomItems.map((item) => item.roomType).filter(Boolean))]
    .join(", ") || booking.roomType;
  const roomNumberSummary = assignedRooms
    .map((room) => room.roomNumber)
    .filter(Boolean)
    .join(", ") || fallbackRoom?.roomNumber || "-";

  const [invoice] = await Invoice.create(
    [
      {
        invoiceNumber: await generateInvoiceNumber({
          session,
          prefix: settingsSnapshot.invoicePrefix
        }),
        bookingId: booking._id,
        guestName: booking.guestName,
        guestEmail: booking.guestEmail,
        roomType: roomTypeSummary,
        roomNumber: roomNumberSummary,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        items,
        subtotal,
        totalAmount: booking.totalAmount,
        paymentMethod: payment.paymentMethod,
        invoiceStatus: "paid",
        settingsSnapshot,
        issuedAt: new Date()
      }
    ],
    sessionOption(session)
  );

  return invoice;
};

const prepareInvoicePdfExport = async (invoiceId) => {
  return {
    invoiceId,
    ready: false,
    message: "PDF export is not implemented yet. Add a PDF renderer here later."
  };
};

module.exports = {
  generateInvoiceForBooking,
  prepareInvoicePdfExport
};
