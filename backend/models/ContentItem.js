const mongoose = require("mongoose");

const contentTypes = ["gallery"];

const contentItemSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: contentTypes,
      required: [true, "type is required"],
      index: true
    },
    title: {
      type: String,
      required: [true, "title is required"],
      trim: true,
      maxlength: 160
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
    sortOrder: {
      type: Number,
      default: 0,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  { timestamps: true }
);

contentItemSchema.index({ type: 1, isActive: 1, sortOrder: 1, createdAt: 1 });

module.exports = mongoose.model("ContentItem", contentItemSchema);
module.exports.contentTypes = contentTypes;
