const mongoose = require("mongoose");

const invoiceStatuses = ["paid", "cancelled"];
const paymentMethods = ["manual_transfer", "virtual_account", "qris", "other"];
const invoiceEmailStatuses = ["pending", "sent", "failed", "not_configured", "skipped"];

const invoiceItemSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: true,
      trim: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    }
  },
  { _id: false }
);

const invoiceSettingsSnapshotSchema = new mongoose.Schema(
  {
    businessName: { type: String, trim: true, default: "The Forest Cabin" },
    businessEmail: { type: String, trim: true, default: "" },
    businessPhone: { type: String, trim: true, default: "" },
    businessAddress: { type: String, trim: true, default: "" },
    websiteUrl: { type: String, trim: true, default: "" },
    logoUrl: { type: String, trim: true, default: "" },
    invoicePrefix: { type: String, trim: true, default: "INV" },
    headerNote: { type: String, trim: true, default: "" },
    footerNote: { type: String, trim: true, default: "" },
    termsAndConditions: { type: String, trim: true, default: "" },
    paymentConfirmationNote: { type: String, trim: true, default: "" },
    emailSubject: { type: String, trim: true, default: "" },
    emailMessage: { type: String, trim: true, default: "" },
    emailClosingNote: { type: String, trim: true, default: "" },
    emailButtonLabel: { type: String, trim: true, default: "" },
    autoSendInvoiceEmail: { type: Boolean, default: true },
    includeBookingStatusLink: { type: Boolean, default: true },
    primaryColor: { type: String, trim: true, default: "#174f37" },
    accentColor: { type: String, trim: true, default: "#f6f3ea" }
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      index: true
    },
    guestName: {
      type: String,
      required: true,
      trim: true
    },
    guestEmail: {
      type: String,
      default: "",
      lowercase: true,
      trim: true
    },
    roomType: {
      type: String,
      required: true
    },
    roomNumber: {
      type: String,
      required: true,
      trim: true
    },
    checkIn: {
      type: Date,
      required: true
    },
    checkOut: {
      type: Date,
      required: true
    },
    items: {
      type: [invoiceItemSchema],
      default: []
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    paymentMethod: {
      type: String,
      enum: paymentMethods,
      required: true
    },
    invoiceStatus: {
      type: String,
      enum: invoiceStatuses,
      default: "paid",
      index: true
    },
    emailStatus: {
      type: String,
      enum: invoiceEmailStatuses,
      default: "pending",
      index: true
    },
    emailedAt: {
      type: Date,
      default: null
    },
    emailError: {
      type: String,
      trim: true,
      default: ""
    },
    settingsSnapshot: {
      type: invoiceSettingsSnapshotSchema,
      default: null
    },
    issuedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Invoice", invoiceSchema);
module.exports.invoiceStatuses = invoiceStatuses;
module.exports.invoiceEmailStatuses = invoiceEmailStatuses;
