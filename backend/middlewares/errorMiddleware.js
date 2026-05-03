const multer = require("multer");
const AppError = require("../utils/AppError");

const notFound = (req, res, next) => {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404));
};

const errorHandler = (err, req, res, next) => {
  let error = err;

  if (err instanceof multer.MulterError) {
    error = new AppError(err.message, 400);
  }

  if (err.name === "CastError") {
    error = new AppError(`Invalid ${err.path}: ${err.value}`, 400);
  }

  if (err.name === "ValidationError") {
    const details = Object.values(err.errors).map((item) => item.message);
    error = new AppError("Validation failed", 400, details);
  }

  if (err.code === 11000) {
    error = new AppError("Duplicate value violates a unique constraint", 409, err.keyValue);
  }

  const statusCode = error.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message: error.message || "Internal server error",
    details: error.details || undefined,
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack
  });
};

module.exports = { notFound, errorHandler };
