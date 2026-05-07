const express = require("express");
const {
  listChannels,
  createChannel,
  updateChannel,
  deleteChannel
} = require("../controllers/channelController");

const router = express.Router();

router.route("/").get(listChannels).post(createChannel);
router.route("/:id").patch(updateChannel).delete(deleteChannel);

module.exports = router;
