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
const { protect, adminOnly } = require("../middlewares/authMiddleware");

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

module.exports = router;
