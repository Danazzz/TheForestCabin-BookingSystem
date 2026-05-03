const Invoice = require("../models/Invoice");
const asyncHandler = require("../utils/asyncHandler");
const sendResponse = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const { validateObjectId } = require("../utils/validators");

const getInvoiceById = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, "invoice id");

  const invoice = await Invoice.findById(req.params.id).populate("bookingId");

  if (!invoice) {
    throw new AppError("Invoice not found", 404);
  }

  sendResponse(res, 200, "Invoice retrieved successfully", invoice);
});

const getInvoiceByBookingId = asyncHandler(async (req, res) => {
  validateObjectId(req.params.bookingId, "booking id");

  const invoice = await Invoice.findOne({ bookingId: req.params.bookingId }).populate(
    "bookingId"
  );

  if (!invoice) {
    throw new AppError("Invoice not found for this booking", 404);
  }

  sendResponse(res, 200, "Invoice retrieved successfully", invoice);
});

module.exports = {
  getInvoiceById,
  getInvoiceByBookingId
};
