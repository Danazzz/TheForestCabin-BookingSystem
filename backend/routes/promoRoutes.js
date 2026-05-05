const express = require("express");
const { listActivePromos } = require("../controllers/promoController");

const router = express.Router();

router.get("/active", listActivePromos);

module.exports = router;
