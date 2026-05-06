const express = require("express");
const {
  getAdminBookings,
  createManualBooking,
  getWaitingApprovalBookings,
  getAdminBookingDetail,
  approvePayment,
  rejectPayment,
  approveBookingAvailability,
  rejectBookingAvailability,
  cancelAdminBooking,
  sendPaymentReminder,
  checkAdminAvailability
} = require("../controllers/adminController");
const {
  getAdminCalendarEvents,
  getCalendarGrid
} = require("../controllers/calendarController");
const {
  listAdminPromos,
  createAdminPromo,
  updateAdminPromo,
  deleteAdminPromo
} = require("../controllers/promoController");
const {
  listAdminGalleryImages,
  createAdminGalleryImage,
  deleteAdminGalleryImage
} = require("../controllers/galleryController");
const {
  listAdminPaymentOptions,
  createAdminPaymentOption,
  updateAdminPaymentOption,
  deleteAdminPaymentOption
} = require("../controllers/paymentOptionController");
const {
  getAdminInvoiceSettings,
  updateAdminInvoiceSettings
} = require("../controllers/invoiceSettingController");
const { protect, adminOnly } = require("../middlewares/authMiddleware");
const { uploadContentImage } = require("../middlewares/uploadMiddleware");

const router = express.Router();

router.use(protect, adminOnly);

router.get("/bookings", getAdminBookings);
router.post("/bookings/manual", createManualBooking);
router.get("/bookings/waiting-approval", getWaitingApprovalBookings);
router.get("/bookings/:id", getAdminBookingDetail);
router.patch("/bookings/:id/availability/approve", approveBookingAvailability);
router.patch("/bookings/:id/availability/reject", rejectBookingAvailability);
router.patch("/bookings/:id/cancel", cancelAdminBooking);
router.post("/bookings/:id/payment-reminder", sendPaymentReminder);
router.patch("/payments/:paymentId/approve", approvePayment);
router.patch("/payments/:paymentId/reject", rejectPayment);
router
  .route("/payment-options")
  .get(listAdminPaymentOptions)
  .post(uploadContentImage, createAdminPaymentOption);
router
  .route("/payment-options/:id")
  .patch(uploadContentImage, updateAdminPaymentOption)
  .delete(deleteAdminPaymentOption);
router
  .route("/invoice-settings")
  .get(getAdminInvoiceSettings)
  .patch(uploadContentImage, updateAdminInvoiceSettings);
router.get("/calendar", getAdminCalendarEvents);
router.get("/calendar/grid", getCalendarGrid);
router.post("/availability/check", checkAdminAvailability);
router
  .route("/promos")
  .get(listAdminPromos)
  .post(uploadContentImage, createAdminPromo);
router
  .route("/promos/:id")
  .patch(uploadContentImage, updateAdminPromo)
  .delete(deleteAdminPromo);
router
  .route("/gallery")
  .get(listAdminGalleryImages)
  .post(uploadContentImage, createAdminGalleryImage);
router.delete("/gallery/:id", deleteAdminGalleryImage);

module.exports = router;
