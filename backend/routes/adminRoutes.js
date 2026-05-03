const express = require("express");
const {
  getWaitingApprovalBookings,
  getAdminBookingDetail,
  approvePayment,
  rejectPayment
} = require("../controllers/adminController");
const { protect, adminOnly } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(protect, adminOnly);

router.get("/bookings/waiting-approval", getWaitingApprovalBookings);
router.get("/bookings/:id", getAdminBookingDetail);
router.patch("/payments/:paymentId/approve", approvePayment);
router.patch("/payments/:paymentId/reject", rejectPayment);

module.exports = router;
