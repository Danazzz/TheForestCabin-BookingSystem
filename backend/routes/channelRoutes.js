const express = require("express");
const {
  listChannels,
  createChannel,
  updateChannel,
  deleteChannel
} = require("../controllers/channelController");
const { protect, adminOnly } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(protect, adminOnly);

router.route("/").get(listChannels).post(createChannel);
router.route("/:id").patch(updateChannel).delete(deleteChannel);

module.exports = router;
