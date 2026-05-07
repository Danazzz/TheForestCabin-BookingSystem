const ContentItem = require("../models/ContentItem");
const asyncHandler = require("../utils/asyncHandler");
const sendResponse = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const { requireFields, validateObjectId } = require("../utils/validators");
const { deleteCloudinaryAsset } = require("../config/cloudinary");

const getUploadedImageUrl = (req) => {
  return req.uploadedFileUrl || "";
};

const listGalleryImages = asyncHandler(async (req, res) => {
  const images = await ContentItem.find({
    type: "gallery",
    isActive: true
  }).sort({ sortOrder: 1, createdAt: 1 });

  sendResponse(res, 200, "Gallery images retrieved successfully", images);
});

const listAdminGalleryImages = asyncHandler(async (req, res) => {
  const images = await ContentItem.find({ type: "gallery" }).sort({
    sortOrder: 1,
    createdAt: 1
  });

  sendResponse(res, 200, "Admin gallery images retrieved successfully", images);
});

const createAdminGalleryImage = asyncHandler(async (req, res) => {
  requireFields(req.body, ["title"]);

  const uploadedImageUrl = getUploadedImageUrl(req);
  const imageUrl = uploadedImageUrl || String(req.body.imageUrl || "").trim();

  if (!imageUrl) {
    throw new AppError("image or imageUrl is required", 400);
  }

  const sortOrder = Number(req.body.sortOrder || 0);

  if (Number.isNaN(sortOrder)) {
    throw new AppError("sortOrder must be a number", 400);
  }

  const image = await ContentItem.create({
    type: "gallery",
    title: String(req.body.title || "").trim(),
    imageUrl,
    imagePublicId: req.uploadedFilePublicId || "",
    altText: String(req.body.altText || "").trim(),
    sortOrder,
    isActive: true
  });

  sendResponse(res, 201, "Gallery image created successfully", image);
});

const deleteAdminGalleryImage = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, "gallery image id");

  const image = await ContentItem.findOneAndDelete({
    _id: req.params.id,
    type: "gallery"
  });

  if (!image) {
    throw new AppError("Gallery image not found", 404);
  }

  if (image.imagePublicId) {
    await deleteCloudinaryAsset(image.imagePublicId).catch(() => null);
  }

  sendResponse(res, 200, "Gallery image deleted successfully", image);
});

module.exports = {
  listGalleryImages,
  listAdminGalleryImages,
  createAdminGalleryImage,
  deleteAdminGalleryImage
};
