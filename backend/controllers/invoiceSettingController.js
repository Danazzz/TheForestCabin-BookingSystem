const InvoiceSetting = require("../models/InvoiceSetting");
const asyncHandler = require("../utils/asyncHandler");
const sendResponse = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const {
  getInvoiceSettings,
  sanitizeInvoicePrefix
} = require("../services/invoiceSettingsService");

const parseBoolean = (value, defaultValue = true) => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return String(value).toLowerCase() === "true";
};

const getUploadedLogoUrl = (req) => {
  return req.uploadedFileUrl || "";
};

const normalizeColor = (value, fieldName) => {
  const color = String(value || "").trim();

  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
    throw new AppError(`${fieldName} must be a hex color like #174f37`, 400);
  }

  return color;
};

const normalizeSettingsPayload = (req) => {
  const body = req.body || {};
  const payload = {};

  [
    "businessName",
    "businessEmail",
    "businessPhone",
    "businessAddress",
    "websiteUrl",
    "headerNote",
    "footerNote",
    "termsAndConditions",
    "paymentConfirmationNote",
    "emailSubject",
    "emailMessage",
    "emailClosingNote",
    "emailButtonLabel"
  ].forEach((field) => {
    if (body[field] !== undefined) {
      payload[field] = String(body[field] || "").trim();
    }
  });

  if (body.invoicePrefix !== undefined) {
    payload.invoicePrefix = sanitizeInvoicePrefix(body.invoicePrefix);
  }

  const uploadedLogoUrl = getUploadedLogoUrl(req);
  if (uploadedLogoUrl || body.logoUrl !== undefined) {
    payload.logoUrl = uploadedLogoUrl || String(body.logoUrl || "").trim();
  }

  if (req.uploadedFilePublicId) {
    payload.logoPublicId = req.uploadedFilePublicId;
  }

  if (body.autoSendInvoiceEmail !== undefined) {
    payload.autoSendInvoiceEmail = parseBoolean(body.autoSendInvoiceEmail);
  }

  if (body.includeBookingStatusLink !== undefined) {
    payload.includeBookingStatusLink = parseBoolean(body.includeBookingStatusLink);
  }

  if (body.primaryColor !== undefined) {
    payload.primaryColor = normalizeColor(body.primaryColor, "primaryColor");
  }

  if (body.accentColor !== undefined) {
    payload.accentColor = normalizeColor(body.accentColor, "accentColor");
  }

  return payload;
};

const getAdminInvoiceSettings = asyncHandler(async (req, res) => {
  const settings = await getInvoiceSettings();

  sendResponse(res, 200, "Invoice settings retrieved successfully", settings);
});

const updateAdminInvoiceSettings = asyncHandler(async (req, res) => {
  await getInvoiceSettings();

  const settings = await InvoiceSetting.findOneAndUpdate(
    { singletonKey: "default" },
    normalizeSettingsPayload(req),
    { new: true, runValidators: true }
  );

  sendResponse(res, 200, "Invoice settings updated successfully", settings);
});

module.exports = {
  getAdminInvoiceSettings,
  updateAdminInvoiceSettings
};
