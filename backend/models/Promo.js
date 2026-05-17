const mongoose = require("mongoose");

const adjustmentTypes = [
  "none",
  "percentage_discount",
  "fixed_discount",
  "bundle_price",
  "surcharge"
];

const normalizePromoRoomType = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizePromoRoomTypes = (values) => {
  if (!Array.isArray(values)) {
    return [];
  }

  return [...new Set(values.map(normalizePromoRoomType).filter(Boolean))];
};

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
    imagePublicId: {
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
    minNights: {
      type: Number,
      default: 0,
      min: [0, "minNights cannot be negative"]
    },
    maxNights: {
      type: Number,
      default: 0,
      min: [0, "maxNights cannot be negative"]
    },
    eligibleRoomTypes: {
      type: [String],
      default: [],
      set: normalizePromoRoomTypes
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

promoSchema.pre("validate", function validateStayRules(next) {
  if (this.maxNights > 0 && this.minNights > this.maxNights) {
    this.invalidate("maxNights", "maxNights must be greater than or equal to minNights");
  }

  next();
});

module.exports = mongoose.model("Promo", promoSchema);
module.exports.adjustmentTypes = adjustmentTypes;
