const ContentItem = require("../models/ContentItem");
const { contentTypes } = require("../models/ContentItem");
const asyncHandler = require("../utils/asyncHandler");
const sendResponse = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const {
  requireFields,
  validateEnum,
  validateObjectId
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

const parseDetails = (value) => {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value)
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const getUploadedImageUrl = (req) => {
  if (!req.file) {
    return "";
  }

  const baseUrl = process.env.UPLOAD_BASE_URL || `${req.protocol}://${req.get("host")}`;

  return `${baseUrl}/uploads/site-content/${req.file.filename}`;
};

const normalizeContentPayload = (req, { partial = false } = {}) => {
  const body = req.body || {};
  const payload = {};

  if (!partial || body.type !== undefined) {
    validateEnum(body.type, contentTypes, "type");
    payload.type = body.type;
  }

  if (!partial || body.title !== undefined || body.name !== undefined) {
    const title = String(body.title || body.name || "").trim();

    if (!title) {
      throw new AppError("title is required", 400);
    }

    payload.title = title;
  }

  if (body.description !== undefined) {
    payload.description = String(body.description || "").trim();
  }

  const uploadedImageUrl = getUploadedImageUrl(req);
  if (uploadedImageUrl || body.imageUrl !== undefined) {
    payload.imageUrl = uploadedImageUrl || String(body.imageUrl || "").trim();
  }

  if (body.altText !== undefined) {
    payload.altText = String(body.altText || "").trim();
  }

  if (body.details !== undefined) {
    payload.details = parseDetails(body.details);
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
  }

  return payload;
};

const listPublicContent = asyncHandler(async (req, res) => {
  validateEnum(req.params.type, contentTypes, "type");

  const items = await ContentItem.find({
    type: req.params.type,
    isActive: true
  }).sort({ sortOrder: 1, createdAt: 1 });

  sendResponse(res, 200, "Content retrieved successfully", items);
});

const listAdminContent = asyncHandler(async (req, res) => {
  const query = {};

  if (req.query.type && req.query.type !== "all") {
    validateEnum(req.query.type, contentTypes, "type");
    query.type = req.query.type;
  }

  if (req.query.includeInactive !== "true") {
    query.isActive = true;
  }

  const items = await ContentItem.find(query).sort({ type: 1, sortOrder: 1, createdAt: 1 });

  sendResponse(res, 200, "Admin content retrieved successfully", items);
});

const getAdminContentItem = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, "content id");

  const item = await ContentItem.findById(req.params.id);

  if (!item) {
    throw new AppError("Content item not found", 404);
  }

  sendResponse(res, 200, "Content item retrieved successfully", item);
});

const createAdminContentItem = asyncHandler(async (req, res) => {
  requireFields(req.body, ["type", "title"]);
  const payload = normalizeContentPayload(req);
  const item = await ContentItem.create(payload);

  sendResponse(res, 201, "Content item created successfully", item);
});

const updateAdminContentItem = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, "content id");
  const payload = normalizeContentPayload(req, { partial: true });

  const item = await ContentItem.findByIdAndUpdate(req.params.id, payload, {
    new: true,
    runValidators: true
  });

  if (!item) {
    throw new AppError("Content item not found", 404);
  }

  sendResponse(res, 200, "Content item updated successfully", item);
});

const deleteAdminContentItem = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, "content id");

  const item = await ContentItem.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );

  if (!item) {
    throw new AppError("Content item not found", 404);
  }

  sendResponse(res, 200, "Content item disabled successfully", item);
});

module.exports = {
  listPublicContent,
  listAdminContent,
  getAdminContentItem,
  createAdminContentItem,
  updateAdminContentItem,
  deleteAdminContentItem
};
