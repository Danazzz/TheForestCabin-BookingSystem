const express = require("express");
const {
  getEventsByProperty,
  getEventsByRoom,
  checkRoomAvailability
} = require("../controllers/calendarController");

const router = express.Router();

router.get("/property/:propertyId", getEventsByProperty);
router.get("/room/:roomId", getEventsByRoom);
router.post("/check-availability", checkRoomAvailability);

module.exports = router;
