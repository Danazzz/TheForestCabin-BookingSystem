const express = require("express");
const {
  listRooms,
  listRoomTypes,
  getRoom,
  createRoom,
  updateRoom,
  deleteRoom,
  getRoomAvailability,
  getRoomAvailabilityCalendar
} = require("../controllers/roomController");

const router = express.Router();

router.get("/availability-calendar", getRoomAvailabilityCalendar);
router.get("/availability", getRoomAvailability);
router.get("/types", listRoomTypes);
router.route("/").get(listRooms).post(createRoom);
router.route("/:id").get(getRoom).patch(updateRoom).delete(deleteRoom);

module.exports = router;
