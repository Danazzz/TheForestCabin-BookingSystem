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

const buildLocalUploadUrl = (req, subdirectory, file = req.file) => {
  const baseUrl = process.env.UPLOAD_BASE_URL || `${req.protocol}://${req.get("host")}`;

  return `${baseUrl}/uploads/${subdirectory}/${file.filename}`;
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

const collectUploadedFiles = (req) => {
  if (Array.isArray(req.files)) {
    return req.files;
  }

  if (req.files && typeof req.files === "object") {
    return Object.values(req.files).flat();
  }

  return req.file ? [req.file] : [];
};

const attachUploadedFilesUrls = async (req, { cloudinaryFolder, localSubdirectory }) => {
  const files = collectUploadedFiles(req);

  if (!files.length) {
    req.uploadedFiles = [];
    return;
  }

  if (isCloudinaryEnabled()) {
    const uploadedFiles = await Promise.all(files.map(async (file) => {
      const result = await uploadBufferToCloudinary({
        buffer: file.buffer,
        folder: cloudinaryFolder,
        originalname: file.originalname
      });

      return {
        url: result.secure_url,
        publicId: result.public_id,
        provider: "cloudinary",
        originalname: file.originalname
      };
    }));

    req.uploadedFiles = uploadedFiles;
    req.uploadedFileUrl = uploadedFiles[0]?.url;
    req.uploadedFileProvider = uploadedFiles[0]?.provider;
    req.uploadedFilePublicId = uploadedFiles[0]?.publicId;
    return;
  }

  req.uploadedFiles = files.map((file) => ({
    url: buildLocalUploadUrl(req, localSubdirectory, file),
    publicId: "",
    provider: "local",
    originalname: file.originalname
  }));
  req.uploadedFileUrl = req.uploadedFiles[0]?.url;
  req.uploadedFileProvider = "local";
  req.uploadedFilePublicId = "";
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

const uploadRoomImages = (req, res, next) => {
  const upload = buildUpload(contentImageDir).fields([
    { name: "image", maxCount: 1 },
    { name: "images", maxCount: 20 }
  ]);

  upload(req, res, async (error) => {
    if (error) {
      next(error);
      return;
    }

    try {
      await attachUploadedFilesUrls(req, {
        cloudinaryFolder: "rooms",
        localSubdirectory: "site-content"
      });
      next();
    } catch (uploadError) {
      next(new AppError(`Failed to upload room images: ${uploadError.message}`, 500));
    }
  });
};

module.exports = { uploadPaymentProof, uploadContentImage, uploadRoomImages };
