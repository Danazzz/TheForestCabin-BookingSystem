const express = require("express");
const {
  loginAdmin,
  getCurrentAdmin
} = require("../controllers/authController");
const { protect, adminOnly } = require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/admin/login", loginAdmin);
router.get("/admin/me", protect, adminOnly, getCurrentAdmin);

module.exports = router;
