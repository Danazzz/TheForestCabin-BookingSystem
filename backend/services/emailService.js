const nodemailer = require("nodemailer");
const Invoice = require("../models/Invoice");
const Booking = require("../models/Booking");
const {
  getInvoiceSettings,
  buildInvoiceSettingsSnapshot,
  renderTemplate
} = require("./invoiceSettingsService");

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

const buildInvoiceUrl = (bookingCode, settings) => {
  if (!settings.includeBookingStatusLink || !process.env.USER_FRONTEND_URL) {
    return "";
  }

  const baseUrl = process.env.USER_FRONTEND_URL.replace(/\/$/, "");

  return `${baseUrl}/?bookingCode=${encodeURIComponent(bookingCode || "")}`;
};

const buildBookingStatusUrl = (bookingCode) => {
  if (!process.env.USER_FRONTEND_URL) {
    return "";
  }

  const baseUrl = process.env.USER_FRONTEND_URL.replace(/\/$/, "");

  return `${baseUrl}/?bookingCode=${encodeURIComponent(bookingCode || "")}`;
};

const buildTemplateVariables = (invoice, settings) => {
  const booking = invoice.bookingId || {};

  return {
    businessName: settings.businessName,
    guestName: invoice.guestName,
    invoiceNumber: invoice.invoiceNumber,
    bookingCode: booking.bookingCode || "",
    roomNumber: invoice.roomNumber,
    roomType: invoice.roomType,
    totalAmount: currencyFormatter.format(invoice.totalAmount || 0)
  };
};

const buildInvoiceEmailHtml = (invoice, settings) => {
  const booking = invoice.bookingId || {};
  const variables = buildTemplateVariables(invoice, settings);
  const invoiceUrl = buildInvoiceUrl(booking.bookingCode, settings);
  const primaryColor = settings.primaryColor || "#174f37";
  const accentColor = settings.accentColor || "#f6f3ea";
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
    <div style="margin:0;background:${escapeHtml(accentColor)};padding:24px;font-family:Arial,sans-serif;color:#1f2937;">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <div style="background:${escapeHtml(primaryColor)};color:#ffffff;padding:24px;">
          ${
            settings.logoUrl
              ? `<img src="${escapeHtml(settings.logoUrl)}" alt="${escapeHtml(settings.businessName)}" style="max-height:56px;max-width:180px;margin-bottom:16px;display:block;" />`
              : ""
          }
          <p style="margin:0;font-size:14px;letter-spacing:1px;text-transform:uppercase;">${escapeHtml(settings.businessName)}</p>
          <h1 style="margin:8px 0 0;font-size:26px;">Invoice ${escapeHtml(invoice.invoiceNumber)}</h1>
        </div>
        <div style="padding:24px;">
          ${
            settings.headerNote
              ? `<p style="margin:0 0 12px;color:${escapeHtml(primaryColor)};font-weight:bold;">${escapeHtml(settings.headerNote)}</p>`
              : ""
          }
          <p style="margin:0 0 16px;">${escapeHtml(renderTemplate(settings.emailMessage, variables))}</p>
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
            <p style="margin:8px 0 0;font-size:22px;font-weight:bold;color:${escapeHtml(primaryColor)};">Total paid: ${currencyFormatter.format(invoice.totalAmount || 0)}</p>
          </div>

          ${
            settings.paymentConfirmationNote
              ? `<p style="margin-top:18px;padding:12px;background:${escapeHtml(accentColor)};border-radius:6px;">${escapeHtml(settings.paymentConfirmationNote)}</p>`
              : ""
          }

          ${
            invoiceUrl
              ? `<p style="margin-top:24px;"><a href="${invoiceUrl}" style="display:inline-block;background:${escapeHtml(primaryColor)};color:#ffffff;padding:12px 16px;border-radius:6px;text-decoration:none;font-weight:bold;">${escapeHtml(settings.emailButtonLabel || "Check booking status")}</a></p>`
              : ""
          }

          ${
            settings.termsAndConditions
              ? `<div style="margin-top:24px;color:#6b7280;font-size:13px;white-space:pre-line;"><strong>Terms:</strong><br />${escapeHtml(settings.termsAndConditions)}</div>`
              : ""
          }
          ${
            settings.emailClosingNote
              ? `<p style="margin-top:24px;">${escapeHtml(settings.emailClosingNote)}</p>`
              : ""
          }
          ${
            settings.footerNote
              ? `<p style="margin-top:20px;color:#6b7280;font-size:12px;">${escapeHtml(settings.footerNote)}</p>`
              : ""
          }
          <div style="margin-top:20px;color:#6b7280;font-size:12px;line-height:1.5;">
            ${
              settings.businessAddress
                ? `<div>${escapeHtml(settings.businessAddress)}</div>`
                : ""
            }
            ${
              settings.businessPhone || settings.businessEmail
                ? `<div>${escapeHtml([settings.businessPhone, settings.businessEmail].filter(Boolean).join(" · "))}</div>`
                : ""
            }
            ${settings.websiteUrl ? `<div>${escapeHtml(settings.websiteUrl)}</div>` : ""}
          </div>
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

  const settings =
    invoice.settingsSnapshot ||
    buildInvoiceSettingsSnapshot(await getInvoiceSettings());

  if (!settings.autoSendInvoiceEmail) {
    invoice.emailStatus = "skipped";
    invoice.emailError = "Auto-send invoice email is disabled in invoice settings";
    await invoice.save();

    return { sent: false, reason: "auto_send_disabled" };
  }

  if (!invoice.guestEmail) {
    invoice.emailStatus = "skipped";
    invoice.emailError = "Guest email is not available";
    await invoice.save();

    return { sent: false, reason: "guest_email_missing" };
  }

  if (!isSmtpConfigured()) {
    invoice.emailStatus = "not_configured";
    invoice.emailError = "SMTP_HOST and SMTP_FROM are not configured";
    await invoice.save();

    return { sent: false, reason: "smtp_not_configured" };
  }

  try {
    const transport = buildTransport();
    const subject = renderTemplate(
      settings.emailSubject || "{{businessName}} Invoice {{invoiceNumber}}",
      buildTemplateVariables(invoice, settings)
    );

    await transport.sendMail({
      from: process.env.SMTP_FROM,
      to: invoice.guestEmail,
      subject,
      html: buildInvoiceEmailHtml(invoice, settings)
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

const buildBookingStatusEmailHtml = ({ booking, settings, title, message, buttonLabel }) => {
  const primaryColor = settings.primaryColor || "#174f37";
  const accentColor = settings.accentColor || "#f6f3ea";
  const bookingUrl = buildBookingStatusUrl(booking.bookingCode);
  const roomLabel = booking.roomId
    ? `${booking.roomId.roomNumber} · ${booking.roomId.name || booking.roomType}`
    : booking.roomType;

  return `
    <div style="margin:0;background:${escapeHtml(accentColor)};padding:24px;font-family:Arial,sans-serif;color:#1f2937;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <div style="background:${escapeHtml(primaryColor)};color:#ffffff;padding:24px;">
          ${
            settings.logoUrl
              ? `<img src="${escapeHtml(settings.logoUrl)}" alt="${escapeHtml(settings.businessName)}" style="max-height:56px;max-width:180px;margin-bottom:16px;display:block;" />`
              : ""
          }
          <p style="margin:0;font-size:14px;letter-spacing:1px;text-transform:uppercase;">${escapeHtml(settings.businessName)}</p>
          <h1 style="margin:8px 0 0;font-size:24px;">${escapeHtml(title)}</h1>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 16px;">${escapeHtml(message)}</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
            <tr>
              <td style="padding:6px 0;color:#6b7280;">Booking code</td>
              <td style="padding:6px 0;text-align:right;font-weight:bold;">${escapeHtml(booking.bookingCode)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;">Guest</td>
              <td style="padding:6px 0;text-align:right;">${escapeHtml(booking.guestName)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;">Room</td>
              <td style="padding:6px 0;text-align:right;">${escapeHtml(roomLabel)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;">Stay dates</td>
              <td style="padding:6px 0;text-align:right;">${formatDate(booking.checkIn)} - ${formatDate(booking.checkOut)}</td>
            </tr>
          </table>
          ${
            bookingUrl
              ? `<p style="margin-top:24px;"><a href="${bookingUrl}" style="display:inline-block;background:${escapeHtml(primaryColor)};color:#ffffff;padding:12px 16px;border-radius:6px;text-decoration:none;font-weight:bold;">${escapeHtml(buttonLabel)}</a></p>`
              : ""
          }
          ${
            settings.footerNote
              ? `<p style="margin-top:20px;color:#6b7280;font-size:12px;">${escapeHtml(settings.footerNote)}</p>`
              : ""
          }
        </div>
      </div>
    </div>
  `;
};

const sendBookingStatusEmail = async ({ bookingId, subject, title, message, buttonLabel }) => {
  const booking = await Booking.findById(bookingId).populate("roomId");

  if (!booking) {
    return { sent: false, reason: "booking_not_found" };
  }

  if (!booking.guestEmail) {
    return { sent: false, reason: "guest_email_missing" };
  }

  if (!isSmtpConfigured()) {
    return { sent: false, reason: "smtp_not_configured" };
  }

  const settings = buildInvoiceSettingsSnapshot(await getInvoiceSettings());
  const transport = buildTransport();

  await transport.sendMail({
    from: process.env.SMTP_FROM,
    to: booking.guestEmail,
    subject: subject.replace("{{businessName}}", settings.businessName),
    html: buildBookingStatusEmailHtml({
      booking,
      settings,
      title,
      message,
      buttonLabel
    })
  });

  return { sent: true };
};

const sendAvailabilityApprovedEmail = (bookingId) =>
  sendBookingStatusEmail({
    bookingId,
    subject: "{{businessName}} booking request approved",
    title: "Booking Request Approved",
    message:
      "Good news, your requested dates are available. Please continue with the payment instructions to secure your booking.",
    buttonLabel: "Continue Payment"
  });

const sendNoRoomAvailableEmail = (bookingId) =>
  sendBookingStatusEmail({
    bookingId,
    subject: "{{businessName}} booking request update",
    title: "Requested Dates Are Not Available",
    message:
      "Thank you for your booking request. Unfortunately, the room is not available for your requested dates. Please choose another date or contact us for assistance.",
    buttonLabel: "Check Booking Status"
  });

module.exports = {
  sendInvoiceEmail,
  sendAvailabilityApprovedEmail,
  sendNoRoomAvailableEmail
};
