const { Readable } = require("stream");
const { v2: cloudinary } = require("cloudinary");

let configured = false;

const getUploadProvider = () => String(process.env.UPLOAD_PROVIDER || "local").toLowerCase();

const isCloudinaryEnabled = () => getUploadProvider() === "cloudinary";

const hasCloudinaryConfig = () =>
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );

const configureCloudinary = () => {
  if (configured) {
    return;
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });

  configured = true;
};

const getCloudinaryRootFolder = () =>
  String(process.env.CLOUDINARY_FOLDER || "theforestcabin")
    .trim()
    .replace(/^\/+|\/+$/g, "");

const uploadBufferToCloudinary = ({ buffer, folder, originalname }) => {
  if (!hasCloudinaryConfig()) {
    throw new Error("Cloudinary credentials are not configured");
  }

  configureCloudinary();

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: [getCloudinaryRootFolder(), folder].filter(Boolean).join("/"),
        resource_type: "image",
        use_filename: true,
        unique_filename: true,
        filename_override: originalname,
        overwrite: false
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result);
      }
    );

    Readable.from(buffer).pipe(uploadStream);
  });
};

const deleteCloudinaryAsset = async (publicId) => {
  if (!publicId || !hasCloudinaryConfig()) {
    return null;
  }

  configureCloudinary();

  return cloudinary.uploader.destroy(publicId, { resource_type: "image" });
};

module.exports = {
  deleteCloudinaryAsset,
  hasCloudinaryConfig,
  isCloudinaryEnabled,
  uploadBufferToCloudinary
};
