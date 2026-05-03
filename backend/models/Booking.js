const mongoose = require("mongoose");

const bookingStatuses = [
  "draft",
  "pending_payment",
  "waiting_admin_approval",
  "success",
  "rejected",
  "cancelled"
];

const paymentStatuses = ["unpaid", "pending", "paid", "failed"];
const bookingSources = ["direct", "airbnb", "agoda", "booking_com"];

const bookingSchema = new mongoose.Schema(
  {
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
      required: [true, "propertyId is required"],
      trim: true,
      index: true
    },
    roomId: {
      type: String,
      required: [true, "roomId is required"],
      trim: true,
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
    totalAmount: {
      type: Number,
      required: [true, "totalAmount is required"],
      min: [0, "totalAmount cannot be negative"]
    },
    bookingStatus: {
      type: String,
      enum: bookingStatuses,
      default: "draft",
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
    calendarEventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CalendarEvent",
      default: null
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      default: null
    }
  },
  { timestamps: true }
);

bookingSchema.index({ roomId: 1, checkIn: 1, checkOut: 1 });
bookingSchema.index({ propertyId: 1, bookingStatus: 1 });

bookingSchema.pre("validate", function validateBookingDates(next) {
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
