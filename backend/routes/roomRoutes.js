const express = require("express");
const {
  listRooms,
  getRoom,
  createRoom,
  updateRoom,
  deleteRoom,
  getRoomAvailability
} = require("../controllers/roomController");

const router = express.Router();

router.get("/availability", getRoomAvailability);
router.route("/").get(listRooms).post(createRoom);
router.route("/:id").get(getRoom).patch(updateRoom).delete(deleteRoom);

module.exports = router;
