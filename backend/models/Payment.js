const mongoose = require("mongoose");

const paymentMethods = ["manual_transfer", "qris", "virtual_account"];
const paymentStatuses = ["pending", "paid", "rejected"];

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
