const dotenv = require("dotenv");

dotenv.config();

const connectDB = require("../config/db");
const AdminUser = require("../models/AdminUser");

const getRequiredEnv = (key) => {
  const value = String(process.env[key] || "").trim();

  if (!value) {
    throw new Error(`${key} is required`);
  }

  return value;
};

const seedAdminUser = async () => {
  await connectDB();

  const email = getRequiredEnv("ADMIN_SEED_EMAIL").toLowerCase();
  const username = String(process.env.ADMIN_SEED_USERNAME || email.split("@")[0])
    .trim()
    .toLowerCase();
  const password = getRequiredEnv("ADMIN_SEED_PASSWORD");
  const name = String(process.env.ADMIN_SEED_NAME || "The Forest Cabin Admin").trim();

  let admin = await AdminUser.findOne({
    $or: [{ email }, { username }]
  }).select("+passwordHash");
  const created = !admin;

  if (!admin) {
    admin = new AdminUser({
      email,
      username,
      name,
      role: "super_admin",
      status: "active"
    });
  } else {
    admin.email = email;
    admin.username = username;
    admin.name = name;
    admin.role = admin.role || "super_admin";
    admin.status = "active";
  }

  await admin.setPassword(password);
  await admin.save();

  console.log(`${created ? "Created" : "Updated"} admin user: ${admin.email}`);
};

seedAdminUser()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed to seed admin user:", error.message);
    process.exit(1);
  });
