const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const bookingRoutes = require("./routes/bookingRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const adminRoutes = require("./routes/adminRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const calendarRoutes = require("./routes/calendarRoutes");
const channelRoutes = require("./routes/channelRoutes");
const roomRoutes = require("./routes/roomRoutes");
const promoRoutes = require("./routes/promoRoutes");
const galleryRoutes = require("./routes/galleryRoutes");
const { notFound, errorHandler } = require("./middlewares/errorMiddleware");

const app = express();

const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  : "*";

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend API is healthy",
    data: {
      service: "forest-cabin-booking-backend",
      timestamp: new Date().toISOString()
    }
  });
});

app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/promos", promoRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/channels", channelRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
