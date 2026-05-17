const express = require("express");
const {
  listRooms,
  listRoomTypes,
  getRoom,
  createRoom,
  updateRoom,
  deleteRoom,
  deleteRoomImage,
  getRoomAvailability,
  getRoomAvailabilityCalendar
} = require("../controllers/roomController");
const { protect, adminOnly } = require("../middlewares/authMiddleware");
const { uploadRoomImages } = require("../middlewares/uploadMiddleware");

const router = express.Router();

router.get("/availability-calendar", getRoomAvailabilityCalendar);
router.get("/availability", getRoomAvailability);
router.get("/types", listRoomTypes);
router.route("/").get(listRooms).post(protect, adminOnly, uploadRoomImages, createRoom);
router.delete("/:id/images/:imageId", protect, adminOnly, deleteRoomImage);
router
  .route("/:id")
  .get(getRoom)
  .patch(protect, adminOnly, uploadRoomImages, updateRoom)
  .delete(protect, adminOnly, deleteRoom);

module.exports = router;
