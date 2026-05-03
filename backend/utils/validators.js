const mongoose = require("mongoose");
const AppError = require("./AppError");

const requireFields = (body, fields) => {
  const missingFields = fields.filter((field) => {
    const value = body[field];
    return value === undefined || value === null || value === "";
  });

  if (missingFields.length > 0) {
    throw new AppError(`Missing required field(s): ${missingFields.join(", ")}`, 400);
  }
};

const validateEnum = (value, allowedValues, fieldName) => {
  if (!allowedValues.includes(value)) {
    throw new AppError(
      `${fieldName} must be one of: ${allowedValues.join(", ")}`,
      400
    );
  }
};

const validateObjectId = (value, fieldName = "id") => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }
};

const parseDate = (value, fieldName) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AppError(`${fieldName} must be a valid date`, 400);
  }

  return date;
};

const validateDateRange = (checkIn, checkOut) => {
  const startDate = parseDate(checkIn, "checkIn");
  const endDate = parseDate(checkOut, "checkOut");

  if (startDate >= endDate) {
    throw new AppError("checkOut must be later than checkIn", 400);
  }

  return { startDate, endDate };
};

const validatePositiveNumber = (value, fieldName, allowZero = false) => {
  const number = Number(value);

  if (Number.isNaN(number) || (allowZero ? number < 0 : number <= 0)) {
    throw new AppError(
      `${fieldName} must be a ${allowZero ? "non-negative" : "positive"} number`,
      400
    );
  }

  return number;
};

module.exports = {
  requireFields,
  validateEnum,
  validateObjectId,
  validateDateRange,
  validatePositiveNumber,
  parseDate
};
