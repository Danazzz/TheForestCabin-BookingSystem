const mongoose = require("mongoose");

const bookingStatuses = [
  "pending_payment",
  "waiting_admin_approval",
  "success",
  "rejected",
  "cancelled"
];

const paymentStatuses = [
  "unpaid",
  "pending",
  "paid",
  "rejected",
  "refund_required"
];
const bookingSources = ["direct"];
const rejectionReasons = [
  "no_room_available",
  "invalid_payment_proof",
  "payment_not_received",
  "guest_cancelled",
  "other"
];

const bookingSchema = new mongoose.Schema(
  {
    bookingCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    guestName: {
      type: String,
      required: [true, "guestName is required"],
      trim: true,
      maxlength: 120
    },
    guestEmail: {
      type: String,
      required: [true, "guestEmail is required"],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "guestEmail must be a valid email"]
    },
    guestPhone: {
      type: String,
      required: [true, "guestPhone is required"],
      trim: true,
      maxlength: 40
    },
    propertyId: {
      type: String,
      default: "the-forest-cabin",
      trim: true,
      index: true
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: [true, "roomId is required"],
      index: true
    },
    roomType: {
      type: String,
      required: [true, "roomType is required"],
      trim: true,
      maxlength: 120
    },
    checkIn: {
      type: Date,
      required: [true, "checkIn is required"]
    },
    checkOut: {
      type: Date,
      required: [true, "checkOut is required"]
    },
    numberOfGuests: {
      type: Number,
      required: [true, "numberOfGuests is required"],
      min: [1, "numberOfGuests must be at least 1"]
    },
    numberOfChildren: {
      type: Number,
      default: 0,
      min: [0, "numberOfChildren cannot be negative"]
    },
    totalAmount: {
      type: Number,
      required: [true, "totalAmount is required"],
      min: [0, "totalAmount cannot be negative"]
    },
    promoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Promo",
      default: null
    },
    promoName: {
      type: String,
      trim: true,
      default: ""
    },
    promoAdjustmentType: {
      type: String,
      trim: true,
      default: ""
    },
    promoAdjustmentValue: {
      type: Number,
      default: 0,
      min: [0, "promoAdjustmentValue cannot be negative"]
    },
    bookingStatus: {
      type: String,
      enum: bookingStatuses,
      default: "pending_payment",
      index: true
    },
    paymentStatus: {
      type: String,
      enum: paymentStatuses,
      default: "unpaid",
      index: true
    },
    source: {
      type: String,
      enum: bookingSources,
      default: "direct",
      index: true
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null
    },
    calendarEventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CalendarEvent",
      default: null
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      default: null
    },
    rejectionReason: {
      type: String,
      enum: rejectionReasons,
      default: null,
      index: true
    },
    adminNote: {
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
    },
    rejectedBy: {
      type: String,
      trim: true,
      default: null
    }
  },
  { timestamps: true }
);

bookingSchema.index({ roomId: 1, checkIn: 1, checkOut: 1 });
bookingSchema.index({ propertyId: 1, bookingStatus: 1 });
bookingSchema.index({ roomType: 1, bookingStatus: 1 });

const buildBookingCode = () => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();

  return `TFC-${datePart}-${randomPart}`;
};

bookingSchema.pre("validate", function validateBookingDates(next) {
  if (!this.bookingCode) {
    this.bookingCode = buildBookingCode();
  }

  if (this.checkIn && this.checkOut && this.checkIn >= this.checkOut) {
    next(new Error("checkOut must be later than checkIn"));
    return;
  }

  next();
});

module.exports = mongoose.model("Booking", bookingSchema);
module.exports.bookingStatuses = bookingStatuses;
module.exports.paymentStatuses = paymentStatuses;
module.exports.bookingSources = bookingSources;
module.exports.rejectionReasons = rejectionReasons;
