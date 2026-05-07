const fs = require("fs");
const path = require("path");
const multer = require("multer");
const AppError = require("../utils/AppError");
const {
  isCloudinaryEnabled,
  uploadBufferToCloudinary
} = require("../config/cloudinary");

const uploadsRoot = path.join(__dirname, "..", "uploads");
const paymentProofDir = path.join(uploadsRoot, "payment-proofs");
const contentImageDir = path.join(uploadsRoot, "site-content");
fs.mkdirSync(paymentProofDir, { recursive: true });
fs.mkdirSync(contentImageDir, { recursive: true });

const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];
const maxUploadSizeMb = Number(process.env.MAX_UPLOAD_SIZE_MB || 5);

const buildStorage = (directory) => multer.diskStorage({
  destination: (req, file, cb) => cb(null, directory),
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const safeBaseName = path
      .basename(file.originalname, extension)
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .slice(0, 40);

    cb(null, `${Date.now()}-${safeBaseName}${extension}`);
  }
});

const memoryStorage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();

  if (!allowedMimeTypes.includes(file.mimetype) || !allowedExtensions.includes(extension)) {
    cb(new AppError("Upload must be an image file: jpg, jpeg, png, or webp", 400));
    return;
  }

  cb(null, true);
};

const buildUpload = (directory) => multer({
  storage: isCloudinaryEnabled() ? memoryStorage : buildStorage(directory),
  fileFilter,
  limits: {
    fileSize: maxUploadSizeMb * 1024 * 1024
  }
});

const buildLocalUploadUrl = (req, subdirectory) => {
  const baseUrl = process.env.UPLOAD_BASE_URL || `${req.protocol}://${req.get("host")}`;

  return `${baseUrl}/uploads/${subdirectory}/${req.file.filename}`;
};

const attachUploadedFileUrl = async (req, { cloudinaryFolder, localSubdirectory }) => {
  if (!req.file) {
    return;
  }

  if (isCloudinaryEnabled()) {
    const result = await uploadBufferToCloudinary({
      buffer: req.file.buffer,
      folder: cloudinaryFolder,
      originalname: req.file.originalname
    });

    req.uploadedFileUrl = result.secure_url;
    req.uploadedFileProvider = "cloudinary";
    req.uploadedFilePublicId = result.public_id;
    return;
  }

  req.uploadedFileUrl = buildLocalUploadUrl(req, localSubdirectory);
  req.uploadedFileProvider = "local";
};

const runSingleImageUpload = ({
  req,
  res,
  next,
  fieldName,
  required = false,
  directory,
  localSubdirectory,
  cloudinaryFolder
}) => {
  const upload = buildUpload(directory).single(fieldName);

  upload(req, res, async (error) => {
    if (error) {
      next(error);
      return;
    }

    if (required && !req.file) {
      next(new AppError(`${fieldName} file is required`, 400));
      return;
    }

    try {
      await attachUploadedFileUrl(req, { cloudinaryFolder, localSubdirectory });
      next();
    } catch (uploadError) {
      next(new AppError(`Failed to upload image: ${uploadError.message}`, 500));
    }
  });
};

const uploadPaymentProof = (req, res, next) => {
  runSingleImageUpload({
    req,
    res,
    next,
    fieldName: "proofImage",
    required: true,
    directory: paymentProofDir,
    localSubdirectory: "payment-proofs",
    cloudinaryFolder: "payment-proofs"
  });
};

const uploadContentImage = (req, res, next) => {
  runSingleImageUpload({
    req,
    res,
    next,
    fieldName: "image",
    required: false,
    directory: contentImageDir,
    localSubdirectory: "site-content",
    cloudinaryFolder: "site-content"
  });
};

module.exports = { uploadPaymentProof, uploadContentImage };
