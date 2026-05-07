const mongoose = require("mongoose");

const paymentMethods = ["manual_transfer", "virtual_account", "qris", "other"];

const paymentOptionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "name is required"],
      trim: true,
      maxlength: 120
    },
    paymentMethod: {
      type: String,
      enum: paymentMethods,
      required: [true, "paymentMethod is required"],
      index: true
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
    imagePublicId: {
      type: String,
      trim: true,
      default: ""
    },
    instructions: {
      type: String,
      trim: true,
      default: ""
    },
    sortOrder: {
      type: Number,
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  { timestamps: true }
);

paymentOptionSchema.index({ paymentMethod: 1, isActive: 1, sortOrder: 1 });

paymentOptionSchema.methods.toSnapshot = function toSnapshot() {
  return {
    paymentOptionId: this._id,
    name: this.name,
    paymentMethod: this.paymentMethod,
    providerLabel: this.providerLabel,
    bankName: this.bankName,
    accountName: this.accountName,
    accountNumber: this.accountNumber,
    merchantName: this.merchantName,
    qrisCode: this.qrisCode,
    imageUrl: this.imageUrl,
    instructions: this.instructions
  };
};

module.exports = mongoose.model("PaymentOption", paymentOptionSchema);
module.exports.paymentMethods = paymentMethods;
