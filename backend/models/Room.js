const mongoose = require("mongoose");

const roomStatuses = ["active", "maintenance", "inactive"];
const normalizeRoomType = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const roomSchema = new mongoose.Schema(
  {
    roomNumber: {
      type: String,
      required: [true, "roomNumber is required"],
      unique: true,
      trim: true,
      index: true
    },
    roomType: {
      type: String,
      required: [true, "roomType is required"],
      set: normalizeRoomType,
      index: true
    },
    name: {
      type: String,
      required: [true, "name is required"],
      trim: true,
      maxlength: 120
    },
    capacity: {
      type: Number,
      required: [true, "capacity is required"],
      min: [1, "capacity must be at least 1"]
    },
    childCapacity: {
      type: Number,
      default: 0,
      min: [0, "childCapacity cannot be negative"]
    },
    basePrice: {
      type: Number,
      required: [true, "basePrice is required"],
      min: [0, "basePrice cannot be negative"]
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000
    },
    imageUrl: {
      type: String,
      trim: true,
      default: ""
    },
    altText: {
      type: String,
      trim: true,
      default: "",
      maxlength: 180
    },
    details: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      enum: roomStatuses,
      default: "active",
      index: true
    }
  },
  { timestamps: true }
);

roomSchema.index({ roomType: 1, status: 1, roomNumber: 1 });

module.exports = mongoose.model("Room", roomSchema);
module.exports.roomStatuses = roomStatuses;
module.exports.normalizeRoomType = normalizeRoomType;
