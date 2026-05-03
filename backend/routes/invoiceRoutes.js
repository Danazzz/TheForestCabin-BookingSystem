const express = require("express");
const {
  getInvoiceById,
  getInvoiceByBookingId
} = require("../controllers/invoiceController");

const router = express.Router();

router.get("/booking/:bookingId", getInvoiceByBookingId);
router.get("/:id", getInvoiceById);

module.exports = router;
