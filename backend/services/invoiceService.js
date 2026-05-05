const Invoice = require("../models/Invoice");
const Room = require("../models/Room");
const AppError = require("../utils/AppError");
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

  const room = await Room.findById(booking.roomId).session(session || null);

  if (!room) {
    throw new AppError("Room not found for invoice generation", 404);
  }

  const subtotal = booking.totalAmount;
  const settings = await getInvoiceSettings({ session });
  const settingsSnapshot = buildInvoiceSettingsSnapshot(settings);
  const items = [
    {
      description: `${room.name} ${room.roomNumber} (${booking.checkIn.toISOString().slice(0, 10)} to ${booking.checkOut.toISOString().slice(0, 10)})`,
      quantity: 1,
      unitPrice: subtotal,
      amount: subtotal
    }
  ];

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
        roomType: booking.roomType,
        roomNumber: room.roomNumber,
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
