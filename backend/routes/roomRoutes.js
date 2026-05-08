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
const { protect, adminOnly } = require("../middlewares/authMiddleware");
const { uploadContentImage } = require("../middlewares/uploadMiddleware");

const router = express.Router();

router.get("/availability-calendar", getRoomAvailabilityCalendar);
router.get("/availability", getRoomAvailability);
router.get("/types", listRoomTypes);
router.route("/").get(listRooms).post(protect, adminOnly, uploadContentImage, createRoom);
router
  .route("/:id")
  .get(getRoom)
  .patch(protect, adminOnly, uploadContentImage, updateRoom)
  .delete(protect, adminOnly, deleteRoom);

module.exports = router;
