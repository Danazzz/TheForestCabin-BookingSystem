const mongoose = require("mongoose");

const normalizeChannelKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const channelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "name is required"],
      trim: true,
      maxlength: 120
    },
    key: {
      type: String,
      required: [true, "key is required"],
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
      set: normalizeChannelKey
    },
    type: {
      type: String,
      trim: true,
      default: "other",
      maxlength: 80
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  { timestamps: true }
);

channelSchema.pre("validate", function setChannelKey(next) {
  if (!this.key) {
    this.key = normalizeChannelKey(this.name);
  }

  next();
});

module.exports = mongoose.model("Channel", channelSchema);
module.exports.normalizeChannelKey = normalizeChannelKey;
