const mongoose = require("mongoose");

const roomTypes = ["deluxe", "suite", "superior"];
const roomStatuses = ["active", "maintenance", "inactive"];

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
      enum: roomTypes,
      required: [true, "roomType is required"],
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
    basePrice: {
      type: Number,
      required: [true, "basePrice is required"],
      min: [0, "basePrice cannot be negative"]
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
module.exports.roomTypes = roomTypes;
module.exports.roomStatuses = roomStatuses;
