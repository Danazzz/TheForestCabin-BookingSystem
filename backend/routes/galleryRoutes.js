const express = require("express");
const { listGalleryImages } = require("../controllers/galleryController");

const router = express.Router();

router.get("/", listGalleryImages);

module.exports = router;
