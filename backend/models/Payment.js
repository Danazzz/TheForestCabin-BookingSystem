const mongoose = require("mongoose");

const paymentMethods = ["manual_transfer", "virtual_account", "qris", "other"];
const paymentStatuses = ["pending", "paid", "rejected"];

const paymentOptionSnapshotSchema = new mongoose.Schema(
  {
    paymentOptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentOption",
      default: null
    },
    name: {
      type: String,
      trim: true,
      default: ""
    },
    paymentMethod: {
      type: String,
      enum: paymentMethods,
      default: "manual_transfer"
    },
    providerLabel: {
      type: String,
      trim: true,
      default: ""
    },
    bankName: {
      type: String,
      trim: true,
      default: ""
    },
    accountName: {
      type: String,
      trim: true,
      default: ""
    },
    accountNumber: {
      type: String,
      trim: true,
      default: ""
    },
    merchantName: {
      type: String,
      trim: true,
      default: ""
    },
    qrisCode: {
      type: String,
      trim: true,
      default: ""
    },
    imageUrl: {
      type: String,
      trim: true,
      default: ""
    },
    instructions: {
      type: String,
      trim: true,
      default: ""
    }
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: [true, "bookingId is required"],
      index: true
    },
    paymentMethod: {
      type: String,
      enum: paymentMethods,
      required: [true, "paymentMethod is required"],
      index: true
    },
    paymentOptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentOption",
      default: null,
      index: true
    },
    paymentOptionSnapshot: {
      type: paymentOptionSnapshotSchema,
      default: null
    },
    amount: {
      type: Number,
      required: [true, "amount is required"],
      min: [0, "amount cannot be negative"]
    },
    paymentStatus: {
      type: String,
      enum: paymentStatuses,
      default: "pending",
      index: true
    },
    proofImageUrl: {
      type: String,
      default: null
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true
    },
    transactionReference: {
      type: String,
      trim: true,
      unique: true,
      sparse: true
    },
    adminNote: {
      type: String,
      trim: true,
      default: null
    },
    approvedBy: {
      type: String,
      trim: true,
      default: null
    },
    approvedAt: {
      type: Date,
      default: null
    },
    rejectedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

paymentSchema.index({ bookingId: 1, paymentStatus: 1 });

module.exports = mongoose.model("Payment", paymentSchema);
module.exports.paymentMethods = paymentMethods;
module.exports.paymentStatuses = paymentStatuses;
