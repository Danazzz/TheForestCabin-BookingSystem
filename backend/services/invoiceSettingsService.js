const InvoiceSetting = require("../models/InvoiceSetting");

const sessionOption = (session) => (session ? { session } : undefined);

const defaultInvoiceSettings = {
  singletonKey: "default",
  businessName: "The Forest Cabin",
  businessEmail: "",
  businessPhone: "",
  businessAddress: "",
  websiteUrl: "",
  logoUrl: "",
  invoicePrefix: "INV",
  headerNote: "Thank you for booking The Forest Cabin.",
  footerNote: "This invoice is automatically generated.",
  termsAndConditions: "",
  paymentConfirmationNote: "Payment has been verified and this booking is confirmed.",
  emailSubject: "{{businessName}} Invoice {{invoiceNumber}}",
  emailMessage:
    "Hi {{guestName}}, your booking has been approved. Your paid invoice is below.",
  emailClosingNote: "We look forward to welcoming you.",
  emailButtonLabel: "Check booking status",
  autoSendInvoiceEmail: true,
  includeBookingStatusLink: true,
  primaryColor: "#174f37",
  accentColor: "#f6f3ea"
};

const getInvoiceSettings = async ({ session } = {}) => {
  let settings = await InvoiceSetting.findOne({ singletonKey: "default" }).session(
    session || null
  );

  if (settings) {
    return settings;
  }

  [settings] = await InvoiceSetting.create([defaultInvoiceSettings], sessionOption(session));

  return settings;
};

const sanitizeInvoicePrefix = (prefix) => {
  const cleanPrefix = String(prefix || "INV")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 12);

  return cleanPrefix || "INV";
};

const buildInvoiceSettingsSnapshot = (settings) => ({
  businessName: settings.businessName,
  businessEmail: settings.businessEmail,
  businessPhone: settings.businessPhone,
  businessAddress: settings.businessAddress,
  websiteUrl: settings.websiteUrl,
  logoUrl: settings.logoUrl,
  invoicePrefix: sanitizeInvoicePrefix(settings.invoicePrefix),
  headerNote: settings.headerNote,
  footerNote: settings.footerNote,
  termsAndConditions: settings.termsAndConditions,
  paymentConfirmationNote: settings.paymentConfirmationNote,
  emailSubject: settings.emailSubject,
  emailMessage: settings.emailMessage,
  emailClosingNote: settings.emailClosingNote,
  emailButtonLabel: settings.emailButtonLabel,
  autoSendInvoiceEmail: Boolean(settings.autoSendInvoiceEmail),
  includeBookingStatusLink: Boolean(settings.includeBookingStatusLink),
  primaryColor: settings.primaryColor,
  accentColor: settings.accentColor
});

const renderTemplate = (template, variables = {}) =>
  String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) =>
    variables[key] ?? match
  );

module.exports = {
  defaultInvoiceSettings,
  getInvoiceSettings,
  sanitizeInvoicePrefix,
  buildInvoiceSettingsSnapshot,
  renderTemplate
};
