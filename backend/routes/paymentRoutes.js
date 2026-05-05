const express = require("express");
const {
  createPayment,
  uploadPaymentProof,
  getPaymentsByBooking,
  webhook
} = require("../controllers/paymentController");
const { listActivePaymentOptions } = require("../controllers/paymentOptionController");
const { uploadPaymentProof: uploadPaymentProofMiddleware } = require("../middlewares/uploadMiddleware");

const router = express.Router();

router.post("/webhook", webhook);
router.get("/options/active", listActivePaymentOptions);
router.get("/booking/:bookingId", getPaymentsByBooking);
router.post("/:bookingId/create", createPayment);
router.post("/:paymentId/upload-proof", uploadPaymentProofMiddleware, uploadPaymentProof);

module.exports = router;
