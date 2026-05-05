const express = require("express");
const { listPublicContent } = require("../controllers/contentController");

const router = express.Router();

router.get("/:type", listPublicContent);

module.exports = router;
