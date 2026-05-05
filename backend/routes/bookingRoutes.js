const express = require("express");
const {
  createBooking,
  getBookings,
  getBookingById,
  getBookingByCode,
  cancelBooking
} = require("../controllers/bookingController");

const router = express.Router();

router.route("/").post(createBooking).get(getBookings);
router.get("/code/:bookingCode", getBookingByCode);
router.get("/:id", getBookingById);
router.patch("/:id/cancel", cancelBooking);

module.exports = router;
