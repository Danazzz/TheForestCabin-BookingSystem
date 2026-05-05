import { useMemo, useState } from "react";
import { bookingApi, invoiceApi, paymentApi, roomApi } from "../services/api";

const PROPERTY_ID = "forest-cabin-main";

const roomOptions = [
  {
    type: "deluxe",
    roomType: "Deluxe Room",
    capacity: 2,
    pricePerNight: 950000,
  },
  {
    type: "suite",
    roomType: "Suite Room",
    capacity: 4,
    pricePerNight: 1250000,
  },
  {
    type: "superior",
    roomType: "Superior Room",
    capacity: 2,
    pricePerNight: 750000,
  },
];

const promoOptions = {
  "": { label: "No Promo", discount: 0 },
  Honeymoon: { label: "Honeymoon Package", discount: 0 },
  Family: { label: "Family Package", discount: 0.05 },
  LongStay: { label: "Stay 3 Nights Discount", discount: 0.1 },
};

const paymentMethodLabels = {
  manual_transfer: "Manual Bank Transfer",
  qris: "QRIS",
  virtual_account: "Virtual Account",
};

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const getNights = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) {
    return 0;
  }

  const startDate = new Date(checkIn);
  const endDate = new Date(checkOut);
  const diff = endDate.getTime() - startDate.getTime();

  if (diff <= 0) {
    return 0;
  }

  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const normalizeError = (error) => {
  if (Array.isArray(error.details) && error.details.length > 0) {
    return `${error.message}: ${error.details.join(", ")}`;
  }

  return error.message || "Something went wrong";
};

export default function BookingSection({ highlight }) {
  const [form, setForm] = useState({
    guestName: "",
    guestEmail: "",
    guestPhone: "",
    checkIn: "",
    checkOut: "",
    guests: 2,
    children: 0,
    roomType: "deluxe",
    promo: "",
    paymentMethod: "manual_transfer",
  });
  const [statusCode, setStatusCode] = useState("");
  const [proofImage, setProofImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [bookingResult, setBookingResult] = useState(null);
  const [availabilityResult, setAvailabilityResult] = useState(null);
  const [invoice, setInvoice] = useState(null);

  const selectedRoom = useMemo(
    () => roomOptions.find((room) => room.type === form.roomType) || roomOptions[0],
    [form.roomType]
  );

  const nights = getNights(form.checkIn, form.checkOut);
  const totalGuests = Number(form.guests) + Number(form.children);
  const discountRate = promoOptions[form.promo]?.discount || 0;
  const subtotal = nights * selectedRoom.pricePerNight;
  const totalAmount = Math.max(0, Math.round(subtotal - subtotal * discountRate));

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const validateForm = () => {
    if (!form.guestName || !form.guestEmail || !form.guestPhone) {
      return "Please complete guest contact details.";
    }

    if (!form.checkIn || !form.checkOut) {
      return "Please select check-in and check-out dates.";
    }

    if (nights <= 0) {
      return "Check-out date must be after check-in date.";
    }

    if (totalGuests <= 0) {
      return "Please enter at least one guest.";
    }

    if (totalGuests > selectedRoom.capacity) {
      return `${selectedRoom.roomType} can host up to ${selectedRoom.capacity} guests.`;
    }

    if (form.paymentMethod === "manual_transfer" && !proofImage) {
      return "Please upload payment proof for manual transfer.";
    }

    return "";
  };

  const loadInvoiceIfAvailable = async (bookingId) => {
    try {
      const invoiceResponse = await invoiceApi.getByBooking(bookingId);
      setInvoice(invoiceResponse.data);
    } catch (invoiceError) {
      if (invoiceError.status !== 404) {
        throw invoiceError;
      }

      setInvoice(null);
    }
  };

  const refreshStatus = async (bookingCode = bookingResult?.booking?.bookingCode) => {
    if (!bookingCode) {
      setError("Enter a booking code first.");
      return;
    }

    setRefreshing(true);
    setError("");

    try {
      const bookingResponse = await bookingApi.getByCode(bookingCode);
      const booking = bookingResponse.data;
      const paymentResponse = await paymentApi.getByBooking(booking._id);

      setBookingResult((previous) => ({
        ...previous,
        booking,
        payments: paymentResponse.data,
        payment: paymentResponse.data?.[0] || previous?.payment || null,
      }));

      await loadInvoiceIfAvailable(booking._id);
    } catch (statusError) {
      setError(normalizeError(statusError));
    } finally {
      setRefreshing(false);
    }
  };

  const handleCheckAvailability = async () => {
    setError("");
    setSuccessMessage("");
    setAvailabilityResult(null);

    if (!form.checkIn || !form.checkOut || nights <= 0) {
      setError("Select valid check-in and check-out dates first.");
      return;
    }

    setCheckingAvailability(true);

    try {
      const response = await roomApi.checkAvailability({
        roomType: selectedRoom.type,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
      });

      setAvailabilityResult(response.data);
    } catch (availabilityError) {
      setError(normalizeError(availabilityError));
    } finally {
      setCheckingAvailability(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");
    setInvoice(null);

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const availabilityResponse = await roomApi.checkAvailability({
        roomType: selectedRoom.type,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
      });

      setAvailabilityResult(availabilityResponse.data);

      if (!availabilityResponse.data.available) {
        setError("This room type is not available for the selected dates.");
        return;
      }

      const bookingResponse = await bookingApi.createBooking({
        guestName: form.guestName,
        guestEmail: form.guestEmail,
        guestPhone: form.guestPhone,
        propertyId: PROPERTY_ID,
        roomType: selectedRoom.type,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        numberOfGuests: totalGuests,
        totalAmount,
        source: "direct",
      });

      const createdBooking = bookingResponse.data;
      const paymentResponse = await paymentApi.createPayment(
        createdBooking._id,
        form.paymentMethod
      );

      let currentBooking = paymentResponse.data.booking;
      let currentPayment = paymentResponse.data.payment;

      if (form.paymentMethod === "manual_transfer") {
        const uploadResponse = await paymentApi.uploadProof(currentPayment._id, proofImage);
        currentBooking = uploadResponse.data.booking;
        currentPayment = uploadResponse.data.payment;
      }

      currentBooking = {
        ...currentBooking,
        bookingCode: currentBooking.bookingCode || createdBooking.bookingCode,
        roomId: createdBooking.roomId,
      };

      setBookingResult({
        booking: currentBooking,
        payment: currentPayment,
        payments: [currentPayment],
        providerPayload: paymentResponse.data.providerPayload,
      });
      setStatusCode(currentBooking.bookingCode || "");

      setSuccessMessage(
        form.paymentMethod === "manual_transfer"
          ? `Booking submitted. Your code is ${currentBooking.bookingCode}. Your payment proof is waiting for admin approval.`
          : `Booking and payment request created. Your code is ${currentBooking.bookingCode}. Please complete your payment.`
      );
    } catch (submitError) {
      setError(normalizeError(submitError));
    } finally {
      setLoading(false);
    }
  };

  const latestPayment = bookingResult?.payment;
  const providerPayload = bookingResult?.providerPayload;

  return (
    <section id="booking" className="bg-white px-4 py-12 text-center">
      <h2 className="mb-6 text-2xl font-bold text-forest">Book Your Stay</h2>

      <form
        onSubmit={handleSubmit}
        className={`mx-auto max-w-2xl rounded-xl bg-cream p-6 text-left shadow-md transition-all duration-500 ${
          highlight ? "scale-105 shadow-2xl ring-2 ring-green-400" : ""
        }`}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <input
            type="text"
            name="guestName"
            value={form.guestName}
            onChange={handleChange}
            className="rounded border p-2"
            placeholder="Guest name"
          />

          <input
            type="email"
            name="guestEmail"
            value={form.guestEmail}
            onChange={handleChange}
            className="rounded border p-2"
            placeholder="Email"
          />

          <input
            type="tel"
            name="guestPhone"
            value={form.guestPhone}
            onChange={handleChange}
            className="rounded border p-2"
            placeholder="Phone"
          />
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            type="date"
            name="checkIn"
            value={form.checkIn}
            onChange={handleChange}
            className="rounded border p-2"
          />

          <input
            type="date"
            name="checkOut"
            value={form.checkOut}
            onChange={handleChange}
            className="rounded border p-2"
          />
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <input
            type="number"
            name="guests"
            min="1"
            value={form.guests}
            onChange={handleChange}
            className="rounded border p-2"
            placeholder="Adults"
          />

          <input
            type="number"
            name="children"
            min="0"
            value={form.children}
            onChange={handleChange}
            className="rounded border p-2"
            placeholder="Kids"
          />

          <select
            name="roomType"
            value={form.roomType}
            onChange={handleChange}
            className="rounded border p-2"
          >
            {roomOptions.map((room) => (
              <option key={room.type} value={room.type}>
                {room.roomType}
              </option>
            ))}
          </select>

          <select
            name="promo"
            value={form.promo}
            onChange={handleChange}
            className="rounded border p-2"
          >
            {Object.entries(promoOptions).map(([value, promo]) => (
              <option key={value || "none"} value={value}>
                {promo.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 rounded border bg-white p-4 text-sm text-gray-700">
          <div className="grid gap-2 md:grid-cols-4">
            <p>
              <span className="font-semibold text-forest">Room:</span>{" "}
              {selectedRoom.roomType}
            </p>
            <p>
              <span className="font-semibold text-forest">Capacity:</span>{" "}
              {selectedRoom.capacity}
            </p>
            <p>
              <span className="font-semibold text-forest">Nights:</span> {nights}
            </p>
            <p>
              <span className="font-semibold text-forest">Total:</span>{" "}
              {currencyFormatter.format(totalAmount)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCheckAvailability}
            disabled={checkingAvailability}
            className="mt-3 rounded border border-forest px-4 py-2 font-semibold text-forest transition hover:bg-forest hover:text-white disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400"
          >
            {checkingAvailability ? "Checking..." : "Check Availability"}
          </button>
          {availabilityResult ? (
            <p className="mt-3 rounded bg-cream p-3">
              {availabilityResult.available
                ? `${availabilityResult.availableCount} ${selectedRoom.roomType.toLowerCase()} unit(s) available for these dates.`
                : `No ${selectedRoom.roomType.toLowerCase()} units available for these dates.`}
            </p>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <select
            name="paymentMethod"
            value={form.paymentMethod}
            onChange={handleChange}
            className="rounded border p-2"
          >
            {Object.entries(paymentMethodLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          {form.paymentMethod === "manual_transfer" ? (
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setProofImage(event.target.files?.[0] || null)}
              className="rounded border bg-white p-2 text-sm"
            />
          ) : (
            <div className="rounded border bg-white p-2 text-sm text-gray-600">
              Payment instructions will appear after booking.
            </div>
          )}
        </div>

        {error ? (
          <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {successMessage ? (
          <div className="mt-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {successMessage}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-4 w-full rounded bg-forest py-2 font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {loading ? "Submitting..." : "Create Booking"}
        </button>

        {bookingResult?.booking ? (
          <div className="mt-5 rounded border bg-white p-4 text-sm text-gray-700">
            <div className="grid gap-2 md:grid-cols-2">
              <p>
                <span className="font-semibold text-forest">Booking code:</span>{" "}
                {bookingResult.booking.bookingCode}
              </p>
              <p>
                <span className="font-semibold text-forest">Room:</span>{" "}
                {bookingResult.booking.roomId?.roomNumber || "-"}{" "}
                {bookingResult.booking.roomId?.name || selectedRoom.roomType}
              </p>
              <p>
                <span className="font-semibold text-forest">Booking status:</span>{" "}
                {bookingResult.booking.bookingStatus}
              </p>
              <p>
                <span className="font-semibold text-forest">Payment status:</span>{" "}
                {latestPayment?.paymentStatus || bookingResult.booking.paymentStatus}
              </p>
              <p>
                <span className="font-semibold text-forest">Method:</span>{" "}
                {paymentMethodLabels[latestPayment?.paymentMethod] || "-"}
              </p>
            </div>

            {providerPayload?.paymentInstructions ? (
              <div className="mt-3 rounded bg-cream p-3">
                {providerPayload.paymentMethod === "virtual_account" ? (
                  <p>
                    VA {providerPayload.paymentInstructions.bankCode}:{" "}
                    <span className="font-semibold">
                      {providerPayload.paymentInstructions.virtualAccountNumber}
                    </span>
                  </p>
                ) : null}

                {providerPayload.paymentMethod === "qris" ? (
                  <p>
                    QRIS reference:{" "}
                    <span className="font-semibold">
                      {providerPayload.paymentInstructions.qrString}
                    </span>
                  </p>
                ) : null}

                {providerPayload.paymentMethod === "manual_transfer" ? (
                  <p>
                    Transfer to {providerPayload.paymentInstructions.bankName}{" "}
                    <span className="font-semibold">
                      {providerPayload.paymentInstructions.accountNumber}
                    </span>{" "}
                    under {providerPayload.paymentInstructions.accountName}.
                  </p>
                ) : null}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => refreshStatus(bookingResult.booking.bookingCode)}
              disabled={refreshing}
              className="mt-3 rounded border border-forest px-4 py-2 font-semibold text-forest transition hover:bg-forest hover:text-white disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400"
            >
              {refreshing ? "Refreshing..." : "Refresh Status"}
            </button>

            {invoice ? (
              <div className="mt-3 rounded border border-green-200 bg-green-50 p-3">
                <p>
                  <span className="font-semibold text-forest">Invoice:</span>{" "}
                  {invoice.invoiceNumber}
                </p>
                <p>
                  <span className="font-semibold text-forest">Invoice status:</span>{" "}
                  {invoice.invoiceStatus}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 rounded border bg-white p-4 text-sm text-gray-700">
          <p className="font-semibold text-forest">Check Booking Status</p>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              value={statusCode}
              onChange={(event) => setStatusCode(event.target.value)}
              className="rounded border p-2 uppercase"
              placeholder="TFC-YYYYMMDD-ABCDE"
            />
            <button
              type="button"
              onClick={() => refreshStatus(statusCode)}
              disabled={refreshing}
              className="rounded bg-forest px-4 py-2 font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {refreshing ? "Checking..." : "Check"}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
