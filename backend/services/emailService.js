const nodemailer = require("nodemailer");
const Invoice = require("../models/Invoice");

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0
});

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC"
      }).format(new Date(value))
    : "-";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const isSmtpConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);

const buildTransport = () => {
  const auth =
    process.env.SMTP_USER || process.env.SMTP_PASS
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      : undefined;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
    auth
  });
};

const buildInvoiceUrl = (bookingCode) => {
  if (!process.env.USER_FRONTEND_URL) {
    return "";
  }

  const baseUrl = process.env.USER_FRONTEND_URL.replace(/\/$/, "");

  return `${baseUrl}/?bookingCode=${encodeURIComponent(bookingCode || "")}`;
};

const buildInvoiceEmailHtml = (invoice) => {
  const booking = invoice.bookingId || {};
  const invoiceUrl = buildInvoiceUrl(booking.bookingCode);
  const itemRows = (invoice.items || [])
    .map(
      (item) => `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.description)}</td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity}</td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;">${currencyFormatter.format(item.unitPrice || 0)}</td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;">${currencyFormatter.format(item.amount || 0)}</td>
        </tr>
      `
    )
    .join("");

  return `
    <div style="margin:0;background:#f6f3ea;padding:24px;font-family:Arial,sans-serif;color:#1f2937;">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <div style="background:#174f37;color:#ffffff;padding:24px;">
          <p style="margin:0;font-size:14px;letter-spacing:1px;text-transform:uppercase;">The Forest Cabin</p>
          <h1 style="margin:8px 0 0;font-size:26px;">Invoice ${escapeHtml(invoice.invoiceNumber)}</h1>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 16px;">Hi ${escapeHtml(invoice.guestName)}, your booking has been approved. Your paid invoice is below.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
            <tr>
              <td style="padding:6px 0;color:#6b7280;">Booking code</td>
              <td style="padding:6px 0;text-align:right;font-weight:bold;">${escapeHtml(booking.bookingCode || "-")}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;">Guest</td>
              <td style="padding:6px 0;text-align:right;">${escapeHtml(invoice.guestName)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;">Room</td>
              <td style="padding:6px 0;text-align:right;">${escapeHtml(invoice.roomNumber)} · ${escapeHtml(invoice.roomType)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;">Stay dates</td>
              <td style="padding:6px 0;text-align:right;">${formatDate(invoice.checkIn)} - ${formatDate(invoice.checkOut)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;">Payment method</td>
              <td style="padding:6px 0;text-align:right;">${escapeHtml(invoice.paymentMethod)}</td>
            </tr>
          </table>

          <table style="width:100%;border-collapse:collapse;margin-top:20px;font-size:14px;">
            <thead>
              <tr style="background:#f9fafb;">
                <th style="padding:12px;text-align:left;border-bottom:1px solid #e5e7eb;">Description</th>
                <th style="padding:12px;text-align:center;border-bottom:1px solid #e5e7eb;">Qty</th>
                <th style="padding:12px;text-align:right;border-bottom:1px solid #e5e7eb;">Unit</th>
                <th style="padding:12px;text-align:right;border-bottom:1px solid #e5e7eb;">Amount</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>

          <div style="margin-top:20px;text-align:right;">
            <p style="margin:4px 0;color:#6b7280;">Subtotal: ${currencyFormatter.format(invoice.subtotal || 0)}</p>
            <p style="margin:8px 0 0;font-size:22px;font-weight:bold;color:#174f37;">Total paid: ${currencyFormatter.format(invoice.totalAmount || 0)}</p>
          </div>

          ${
            invoiceUrl
              ? `<p style="margin-top:24px;"><a href="${invoiceUrl}" style="display:inline-block;background:#174f37;color:#ffffff;padding:12px 16px;border-radius:6px;text-decoration:none;font-weight:bold;">Check booking status</a></p>`
              : ""
          }
        </div>
      </div>
    </div>
  `;
};

const sendInvoiceEmail = async (invoiceId) => {
  const invoice = await Invoice.findById(invoiceId).populate("bookingId");

  if (!invoice) {
    return { sent: false, reason: "invoice_not_found" };
  }

  if (!isSmtpConfigured()) {
    invoice.emailStatus = "not_configured";
    invoice.emailError = "SMTP_HOST and SMTP_FROM are not configured";
    await invoice.save();

    return { sent: false, reason: "smtp_not_configured" };
  }

  try {
    const transport = buildTransport();

    await transport.sendMail({
      from: process.env.SMTP_FROM,
      to: invoice.guestEmail,
      subject: `The Forest Cabin Invoice ${invoice.invoiceNumber}`,
      html: buildInvoiceEmailHtml(invoice)
    });

    invoice.emailStatus = "sent";
    invoice.emailedAt = new Date();
    invoice.emailError = "";
    await invoice.save();

    return { sent: true };
  } catch (error) {
    invoice.emailStatus = "failed";
    invoice.emailError = error.message || "Failed to send invoice email";
    await invoice.save();

    return { sent: false, reason: "send_failed", error: invoice.emailError };
  }
};

module.exports = {
  sendInvoiceEmail
};
