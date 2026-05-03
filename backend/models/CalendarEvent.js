const mongoose = require("mongoose");

const calendarStatuses = ["confirmed", "cancelled"];
const calendarSources = ["direct", "airbnb", "agoda", "booking_com"];

const calendarEventSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      index: true
    },
    propertyId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    roomId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    roomType: {
      type: String,
      required: true,
      trim: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    startDate: {
      type: Date,
      required: true,
      index: true
    },
    endDate: {
      type: Date,
      required: true,
      index: true
    },
    guestName: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: calendarStatuses,
      default: "confirmed",
      index: true
    },
    source: {
      type: String,
      enum: calendarSources,
      default: "direct",
      index: true
    }
  },
  { timestamps: true }
);

calendarEventSchema.index({ roomId: 1, startDate: 1, endDate: 1, status: 1 });
calendarEventSchema.index({ propertyId: 1, startDate: 1, endDate: 1 });

calendarEventSchema.pre("validate", function validateCalendarDates(next) {
  if (this.startDate && this.endDate && this.startDate >= this.endDate) {
    next(new Error("endDate must be later than startDate"));
    return;
  }

  next();
});

module.exports = mongoose.model("CalendarEvent", calendarEventSchema);
module.exports.calendarStatuses = calendarStatuses;
module.exports.calendarSources = calendarSources;
