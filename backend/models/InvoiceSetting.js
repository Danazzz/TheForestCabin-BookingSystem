const mongoose = require("mongoose");

const invoiceSettingSchema = new mongoose.Schema(
  {
    singletonKey: {
      type: String,
      default: "default",
      unique: true,
      index: true
    },
    businessName: {
      type: String,
      trim: true,
      default: "The Forest Cabin"
    },
    businessEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: ""
    },
    businessPhone: {
      type: String,
      trim: true,
      default: ""
    },
    businessAddress: {
      type: String,
      trim: true,
      default: ""
    },
    websiteUrl: {
      type: String,
      trim: true,
      default: ""
    },
    logoUrl: {
      type: String,
      trim: true,
      default: ""
    },
    invoicePrefix: {
      type: String,
      trim: true,
      uppercase: true,
      default: "INV",
      maxlength: 12
    },
    headerNote: {
      type: String,
      trim: true,
      default: "Thank you for booking The Forest Cabin."
    },
    footerNote: {
      type: String,
      trim: true,
      default: "This invoice is automatically generated."
    },
    termsAndConditions: {
      type: String,
      trim: true,
      default: ""
    },
    paymentConfirmationNote: {
      type: String,
      trim: true,
      default: "Payment has been verified and this booking is confirmed."
    },
    emailSubject: {
      type: String,
      trim: true,
      default: "{{businessName}} Invoice {{invoiceNumber}}"
    },
    emailMessage: {
      type: String,
      trim: true,
      default: "Hi {{guestName}}, your booking has been approved. Your paid invoice is below."
    },
    emailClosingNote: {
      type: String,
      trim: true,
      default: "We look forward to welcoming you."
    },
    emailButtonLabel: {
      type: String,
      trim: true,
      default: "Check booking status"
    },
    autoSendInvoiceEmail: {
      type: Boolean,
      default: true
    },
    includeBookingStatusLink: {
      type: Boolean,
      default: true
    },
    primaryColor: {
      type: String,
      trim: true,
      default: "#174f37"
    },
    accentColor: {
      type: String,
      trim: true,
      default: "#f6f3ea"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("InvoiceSetting", invoiceSettingSchema);
