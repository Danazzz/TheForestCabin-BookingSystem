const express = require("express");
const {
  getAdminBookings,
  getWaitingApprovalBookings,
  getAdminBookingDetail,
  approvePayment,
  rejectPayment,
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
const { protect, adminOnly } = require("../middlewares/authMiddleware");
const { uploadContentImage } = require("../middlewares/uploadMiddleware");

const router = express.Router();

router.use(protect, adminOnly);

router.get("/bookings", getAdminBookings);
router.get("/bookings/waiting-approval", getWaitingApprovalBookings);
router.get("/bookings/:id", getAdminBookingDetail);
router.patch("/payments/:paymentId/approve", approvePayment);
router.patch("/payments/:paymentId/reject", rejectPayment);
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
