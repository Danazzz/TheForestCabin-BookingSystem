const protect = (req, res, next) => {
  // Placeholder for JWT/session auth. Kept permissive until auth is added.
  req.user = {
    id: req.header("x-admin-id") || "system-admin",
    role: req.header("x-user-role") || "admin"
  };
  next();
};

const adminOnly = (req, res, next) => {
  // Placeholder for role checks. Wire this to req.user.role once auth exists.
  next();
};

module.exports = { protect, adminOnly };
