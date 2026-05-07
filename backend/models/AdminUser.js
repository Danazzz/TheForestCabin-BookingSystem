const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const adminRoles = ["admin", "super_admin"];
const adminStatuses = ["active", "inactive"];

const adminUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: "Admin"
    },
    email: {
      type: String,
      required: [true, "email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (value) => /^\S+@\S+\.\S+$/.test(value),
        message: "email must be a valid email"
      }
    },
    username: {
      type: String,
      required: [true, "username is required"],
      unique: true,
      lowercase: true,
      trim: true,
      minlength: [3, "username must be at least 3 characters"],
      maxlength: [60, "username cannot exceed 60 characters"]
    },
    passwordHash: {
      type: String,
      required: [true, "passwordHash is required"],
      select: false
    },
    role: {
      type: String,
      enum: adminRoles,
      default: "admin",
      index: true
    },
    status: {
      type: String,
      enum: adminStatuses,
      default: "active",
      index: true
    },
    lastLoginAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

adminUserSchema.methods.setPassword = async function setPassword(password) {
  this.passwordHash = await bcrypt.hash(String(password), 12);
};

adminUserSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(String(password), this.passwordHash);
};

adminUserSchema.methods.toSafeObject = function toSafeObject() {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    username: this.username,
    role: this.role,
    status: this.status,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model("AdminUser", adminUserSchema);
module.exports.adminRoles = adminRoles;
module.exports.adminStatuses = adminStatuses;
