const fs = require("fs");
const path = require("path");
const multer = require("multer");
const AppError = require("../utils/AppError");

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

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();

  if (!allowedMimeTypes.includes(file.mimetype) || !allowedExtensions.includes(extension)) {
    cb(new AppError("Payment proof must be an image file: jpg, jpeg, png, or webp", 400));
    return;
  }

  cb(null, true);
};

const buildUpload = (directory) => multer({
  storage: buildStorage(directory),
  fileFilter,
  limits: {
    fileSize: maxUploadSizeMb * 1024 * 1024
  }
});

const paymentProofUpload = buildUpload(paymentProofDir);
const contentImageUpload = buildUpload(contentImageDir);

const uploadPaymentProof = (req, res, next) => {
  paymentProofUpload.single("proofImage")(req, res, (error) => {
    if (error) {
      next(error);
      return;
    }

    if (!req.file) {
      next(new AppError("proofImage file is required", 400));
      return;
    }

    next();
  });
};

const uploadContentImage = (req, res, next) => {
  contentImageUpload.single("image")(req, res, (error) => {
    if (error) {
      next(error);
      return;
    }

    next();
  });
};

module.exports = { uploadPaymentProof, uploadContentImage };
