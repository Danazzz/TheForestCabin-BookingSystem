const AdminUser = require("../models/AdminUser");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken } = require("../utils/jwt");

const protect = asyncHandler(async (req, res, next) => {
  const authorization = req.header("Authorization") || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new AppError("Authentication token is required", 401);
  }

  let payload;

  try {
    payload = verifyToken(token);
  } catch (error) {
    if (["JsonWebTokenError", "TokenExpiredError"].includes(error.name)) {
      throw new AppError("Invalid or expired authentication token", 401);
    }

    throw error;
  }

  if (payload.type !== "admin" || !payload.sub) {
    throw new AppError("Invalid authentication token", 401);
  }

  const admin = await AdminUser.findById(payload.sub);

  if (!admin || admin.status !== "active") {
    throw new AppError("Admin account is not active", 403);
  }

  req.user = admin.toSafeObject();
  next();
});

const adminOnly = (req, res, next) => {
  if (!["admin", "super_admin"].includes(req.user?.role)) {
    next(new AppError("Admin access is required", 403));
    return;
  }

  next();
};

module.exports = { protect, adminOnly };
