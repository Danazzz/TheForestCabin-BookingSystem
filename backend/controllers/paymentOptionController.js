const PaymentOption = require("../models/PaymentOption");
const asyncHandler = require("../utils/asyncHandler");
const sendResponse = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const {
  validateEnum,
  validateObjectId
} = require("../utils/validators");
const { paymentMethods } = require("../models/PaymentOption");

const paymentMethodPriority = {
  manual_transfer: 1,
  virtual_account: 2,
  qris: 3,
  other: 4
};

const parseBoolean = (value, defaultValue = true) => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return String(value).toLowerCase() === "true";
};

const getUploadedImageUrl = (req) => {
  if (!req.file) {
    return "";
  }

  const baseUrl = process.env.UPLOAD_BASE_URL || `${req.protocol}://${req.get("host")}`;

  return `${baseUrl}/uploads/site-content/${req.file.filename}`;
};

const buildPaymentOptionName = (paymentOption) => {
  if (paymentOption.paymentMethod === "manual_transfer") {
    return `Transfer Rekening ${paymentOption.bankName || ""}`.trim();
  }

  if (paymentOption.paymentMethod === "virtual_account") {
    return `Virtual Account ${paymentOption.bankName || ""}`.trim();
  }

  if (paymentOption.paymentMethod === "qris") {
    return `QRIS ${paymentOption.merchantName || ""}`.trim();
  }

  return paymentOption.merchantName || paymentOption.bankName || "Other Payment";
};

const sortPaymentOptions = (options) =>
  options.sort((first, second) => {
    const priorityDiff =
      (paymentMethodPriority[first.paymentMethod] || 99) -
      (paymentMethodPriority[second.paymentMethod] || 99);

    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return buildPaymentOptionName(first).localeCompare(buildPaymentOptionName(second));
  });

const normalizePayload = (req, { partial = false } = {}) => {
  const body = req.body || {};
  const payload = {};

  if (!partial || body.paymentMethod !== undefined) {
    validateEnum(body.paymentMethod, paymentMethods, "paymentMethod");
    payload.paymentMethod = body.paymentMethod;
  }

  [
    "bankName",
    "accountName",
    "accountNumber",
    "merchantName",
    "qrisCode",
    "instructions"
  ].forEach((field) => {
    if (body[field] !== undefined) {
      payload[field] = String(body[field] || "").trim();
    }
  });

  const uploadedImageUrl = getUploadedImageUrl(req);
  if (uploadedImageUrl || body.imageUrl !== undefined) {
    payload.imageUrl = uploadedImageUrl || String(body.imageUrl || "").trim();
  }

  if (body.sortOrder !== undefined) {
    const sortOrder = Number(body.sortOrder || 0);

    if (Number.isNaN(sortOrder)) {
      throw new AppError("sortOrder must be a number", 400);
    }

    payload.sortOrder = sortOrder;
  }

  if (body.isActive !== undefined) {
    payload.isActive = parseBoolean(body.isActive);
  } else if (!partial) {
    payload.isActive = true;
  }

  return payload;
};

const validatePaymentOption = (paymentOption) => {
  if (paymentOption.paymentMethod === "qris") {
    if (!paymentOption.imageUrl && !paymentOption.qrisCode) {
      throw new AppError("QRIS payment requires imageUrl/image upload or qrisCode", 400);
    }

    return;
  }

  if (paymentOption.paymentMethod === "other") {
    if (!paymentOption.merchantName && !paymentOption.bankName) {
      throw new AppError("Other payment requires a payment name", 400);
    }

    return;
  }

  if (!paymentOption.bankName || !paymentOption.accountName || !paymentOption.accountNumber) {
    throw new AppError(
      "Bank transfer and virtual account payments require bankName, accountName, and accountNumber",
      400
    );
  }
};

const listActivePaymentOptions = asyncHandler(async (req, res) => {
  const options = sortPaymentOptions(
    await PaymentOption.find({ isActive: true })
  );

  sendResponse(res, 200, "Active payment options retrieved successfully", options);
});

const listAdminPaymentOptions = asyncHandler(async (req, res) => {
  const query = {};

  if (req.query.includeInactive !== "true") {
    query.isActive = true;
  }

  const options = sortPaymentOptions(await PaymentOption.find(query));

  sendResponse(res, 200, "Payment options retrieved successfully", options);
});

const createAdminPaymentOption = asyncHandler(async (req, res) => {
  if (!req.body?.paymentMethod) {
    throw new AppError("paymentMethod is required", 400);
  }

  const payload = normalizePayload(req);
  payload.name = buildPaymentOptionName(payload);
  validatePaymentOption(payload);

  const option = await PaymentOption.create(payload);

  sendResponse(res, 201, "Payment option created successfully", option);
});

const updateAdminPaymentOption = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, "payment option id");

  const option = await PaymentOption.findById(req.params.id);

  if (!option) {
    throw new AppError("Payment option not found", 404);
  }

  Object.assign(option, normalizePayload(req, { partial: true }));
  validatePaymentOption(option);
  option.name = buildPaymentOptionName(option);
  await option.save();

  sendResponse(res, 200, "Payment option updated successfully", option);
});

const deleteAdminPaymentOption = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, "payment option id");

  const option = await PaymentOption.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );

  if (!option) {
    throw new AppError("Payment option not found", 404);
  }

  sendResponse(res, 200, "Payment option disabled successfully", option);
});

module.exports = {
  listActivePaymentOptions,
  listAdminPaymentOptions,
  createAdminPaymentOption,
  updateAdminPaymentOption,
  deleteAdminPaymentOption
};
