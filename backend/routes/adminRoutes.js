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
  listAdminContent,
  getAdminContentItem,
  createAdminContentItem,
  updateAdminContentItem,
  deleteAdminContentItem
} = require("../controllers/contentController");
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
  .route("/content")
  .get(listAdminContent)
  .post(uploadContentImage, createAdminContentItem);
router
  .route("/content/:id")
  .get(getAdminContentItem)
  .patch(uploadContentImage, updateAdminContentItem)
  .delete(deleteAdminContentItem);

module.exports = router;
