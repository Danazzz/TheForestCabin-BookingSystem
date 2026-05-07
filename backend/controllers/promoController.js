const Promo = require("../models/Promo");
const { adjustmentTypes } = require("../models/Promo");
const asyncHandler = require("../utils/asyncHandler");
const sendResponse = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const {
  requireFields,
  validateEnum,
  validateObjectId,
  parseDate
} = require("../utils/validators");

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
  return req.uploadedFileUrl || "";
};

const parseStartDate = (value, fieldName) => {
  const date = parseDate(value, fieldName);
  date.setUTCHours(0, 0, 0, 0);

  return date;
};

const parseEndDate = (value, fieldName) => {
  const date = parseDate(value, fieldName);
  date.setUTCHours(23, 59, 59, 999);

  return date;
};

const normalizePromoPayload = (req, { partial = false } = {}) => {
  const body = req.body || {};
  const payload = {};

  if (!partial || body.name !== undefined) {
    const name = String(body.name || "").trim();

    if (!name) {
      throw new AppError("name is required", 400);
    }

    payload.name = name;
  }

  if (body.description !== undefined) {
    payload.description = String(body.description || "").trim();
  }

  const uploadedImageUrl = getUploadedImageUrl(req);
  if (uploadedImageUrl || body.imageUrl !== undefined) {
    payload.imageUrl = uploadedImageUrl || String(body.imageUrl || "").trim();
  }

  if (req.uploadedFilePublicId) {
    payload.imagePublicId = req.uploadedFilePublicId;
  }

  if (body.adjustmentType !== undefined) {
    validateEnum(body.adjustmentType, adjustmentTypes, "adjustmentType");
    payload.adjustmentType = body.adjustmentType;
  } else if (!partial) {
    payload.adjustmentType = "none";
  }

  if (body.adjustmentValue !== undefined) {
    const adjustmentValue = Number(body.adjustmentValue || 0);

    if (Number.isNaN(adjustmentValue) || adjustmentValue < 0) {
      throw new AppError("adjustmentValue must be a non-negative number", 400);
    }

    payload.adjustmentValue = adjustmentValue;
  } else if (!partial) {
    payload.adjustmentValue = 0;
  }

  if (body.validFrom !== undefined) {
    payload.validFrom = body.validFrom ? parseStartDate(body.validFrom, "validFrom") : null;
  }

  if (body.validUntil !== undefined) {
    payload.validUntil = body.validUntil ? parseEndDate(body.validUntil, "validUntil") : null;
  }

  if (
    payload.validFrom &&
    payload.validUntil &&
    payload.validFrom > payload.validUntil
  ) {
    throw new AppError("validUntil must be the same as or later than validFrom", 400);
  }

  if (body.isActive !== undefined) {
    payload.isActive = parseBoolean(body.isActive);
  }

  return payload;
};

const getActivePromoQuery = () => {
  const now = new Date();

  return {
    isActive: true,
    $and: [
      { $or: [{ validFrom: null }, { validFrom: { $lte: now } }] },
      { $or: [{ validUntil: null }, { validUntil: { $gte: now } }] }
    ]
  };
};

const listActivePromos = asyncHandler(async (req, res) => {
  const promos = await Promo.find(getActivePromoQuery()).sort({ createdAt: -1 });

  sendResponse(res, 200, "Active promos retrieved successfully", promos);
});

const listAdminPromos = asyncHandler(async (req, res) => {
  const query = {};

  if (req.query.includeInactive !== "true") {
    query.isActive = true;
  }

  const promos = await Promo.find(query).sort({ createdAt: -1 });

  sendResponse(res, 200, "Promos retrieved successfully", promos);
});

const createAdminPromo = asyncHandler(async (req, res) => {
  requireFields(req.body, ["name"]);
  const payload = normalizePromoPayload(req);
  const promo = await Promo.create(payload);

  sendResponse(res, 201, "Promo created successfully", promo);
});

const updateAdminPromo = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, "promo id");
  const payload = normalizePromoPayload(req, { partial: true });

  const promo = await Promo.findByIdAndUpdate(req.params.id, payload, {
    new: true,
    runValidators: true
  });

  if (!promo) {
    throw new AppError("Promo not found", 404);
  }

  sendResponse(res, 200, "Promo updated successfully", promo);
});

const deleteAdminPromo = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, "promo id");

  const promo = await Promo.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );

  if (!promo) {
    throw new AppError("Promo not found", 404);
  }

  sendResponse(res, 200, "Promo disabled successfully", promo);
});

module.exports = {
  listActivePromos,
  listAdminPromos,
  createAdminPromo,
  updateAdminPromo,
  deleteAdminPromo
};
