const jwt = require("jsonwebtoken");
const AppError = require("./AppError");

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new AppError("JWT_SECRET is not configured", 500);
  }

  return process.env.JWT_SECRET;
};

const signAdminToken = (adminUser) =>
  jwt.sign(
    {
      sub: String(adminUser._id),
      role: adminUser.role,
      type: "admin"
    },
    getJwtSecret(),
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d"
    }
  );

const verifyToken = (token) => jwt.verify(token, getJwtSecret());

module.exports = {
  signAdminToken,
  verifyToken
};
