const Invoice = require("../models/Invoice");

const sessionOption = (session) => (session ? { session } : undefined);

const generateInvoiceNumber = async ({ session } = {}) => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
    const invoiceNumber = `INV-${datePart}-${randomPart}`;
    const existingInvoice = await Invoice.findOne({ invoiceNumber }).session(session || null);

    if (!existingInvoice) {
      return invoiceNumber;
    }
  }

  return `INV-${datePart}-${Date.now()}`;
};

const generateInvoiceForBooking = async (booking, payment, { session } = {}) => {
  const existingInvoice = await Invoice.findOne({ bookingId: booking._id }).session(
    session || null
  );

  if (existingInvoice) {
    return existingInvoice;
  }

  const subtotal = booking.totalAmount;
  const items = [
    {
      description: `${booking.roomType} booking (${booking.checkIn.toISOString().slice(0, 10)} to ${booking.checkOut.toISOString().slice(0, 10)})`,
      quantity: 1,
      unitPrice: subtotal,
      amount: subtotal
    }
  ];

  const [invoice] = await Invoice.create(
    [
      {
        invoiceNumber: await generateInvoiceNumber({ session }),
        bookingId: booking._id,
        guestName: booking.guestName,
        guestEmail: booking.guestEmail,
        items,
        subtotal,
        totalAmount: booking.totalAmount,
        paymentMethod: payment.paymentMethod,
        invoiceStatus: "paid",
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
