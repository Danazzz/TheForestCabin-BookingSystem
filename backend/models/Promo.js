const mongoose = require("mongoose");

const adjustmentTypes = [
  "none",
  "percentage_discount",
  "fixed_discount",
  "bundle_price",
  "surcharge"
];

const promoSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "name is required"],
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
    adjustmentType: {
      type: String,
      enum: adjustmentTypes,
      default: "none"
    },
    adjustmentValue: {
      type: Number,
      default: 0,
      min: [0, "adjustmentValue cannot be negative"]
    },
    validFrom: {
      type: Date,
      default: null,
      index: true
    },
    validUntil: {
      type: Date,
      default: null,
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

promoSchema.index({ isActive: 1, validFrom: 1, validUntil: 1, createdAt: -1 });

module.exports = mongoose.model("Promo", promoSchema);
module.exports.adjustmentTypes = adjustmentTypes;
