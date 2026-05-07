const AdminUser = require("../models/AdminUser");
const asyncHandler = require("../utils/asyncHandler");
const sendResponse = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const { signAdminToken } = require("../utils/jwt");

const normalizeIdentifier = (body = {}) =>
  String(body.identifier || body.email || body.username || "")
    .trim()
    .toLowerCase();

const loginAdmin = asyncHandler(async (req, res) => {
  const identifier = normalizeIdentifier(req.body);
  const password = String(req.body?.password || "");

  if (!identifier || !password) {
    throw new AppError("Email/username and password are required", 400);
  }

  const admin = await AdminUser.findOne({
    $or: [{ email: identifier }, { username: identifier }]
  }).select("+passwordHash");

  if (!admin || !(await admin.comparePassword(password))) {
    throw new AppError("Invalid admin credentials", 401);
  }

  if (admin.status !== "active") {
    throw new AppError("Admin account is inactive", 403);
  }

  admin.lastLoginAt = new Date();
  await admin.save();

  sendResponse(res, 200, "Admin login successful", {
    token: signAdminToken(admin),
    user: admin.toSafeObject()
  });
});

const getCurrentAdmin = asyncHandler(async (req, res) => {
  sendResponse(res, 200, "Current admin retrieved successfully", req.user);
});

module.exports = {
  loginAdmin,
  getCurrentAdmin
};
