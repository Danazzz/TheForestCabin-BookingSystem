import { useEffect, useMemo, useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { bookingApi, invoiceApi, paymentApi, promoApi, roomApi } from "../services/api";

const PROPERTY_ID = "forest-cabin-main";

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

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const calendarWeekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toDateInput = (date) => date.toISOString().slice(0, 10);

const getMonthStart = (date = new Date()) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

const getMonthEnd = (date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));

const shiftMonth = (date, offset) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));

const buildCalendarCells = (monthDate, availabilityDates = []) => {
  const monthStart = getMonthStart(monthDate);
  const daysInMonth = getMonthEnd(monthDate).getUTCDate();
  const leadingBlanks = monthStart.getUTCDay();
  const availabilityByDate = new Map(
    availabilityDates.map((day) => [day.date, day])
  );

  return [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(
        Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), index + 1)
      );
      const dateKey = toDateInput(date);

      return {
        date: dateKey,
        dayNumber: index + 1,
        ...(availabilityByDate.get(dateKey) || {
          totalRooms: 0,
          bookedCount: 0,
          availableCount: 0,
          isAvailable: false,
        }),
      };
    }),
  ];
};

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

const applyPromoPricing = (subtotal, promo) => {
  if (!promo || subtotal <= 0) {
    return subtotal;
  }

  const value = Number(promo.adjustmentValue || 0);

  if (promo.adjustmentType === "percentage_discount") {
    return subtotal - subtotal * Math.min(value, 100) / 100;
  }

  if (promo.adjustmentType === "fixed_discount") {
    return subtotal - value;
  }

  if (promo.adjustmentType === "bundle_price") {
    return value;
  }

  if (promo.adjustmentType === "surcharge") {
    return subtotal + value;
  }

  return subtotal;
};

const formatPromoRule = (promo) => {
  const value = Number(promo.adjustmentValue || 0);

  if (promo.adjustmentType === "percentage_discount") {
    return `${value}% off`;
  }

  if (promo.adjustmentType === "fixed_discount") {
    return `${currencyFormatter.format(value)} off`;
  }

  if (promo.adjustmentType === "bundle_price") {
    return `Bundle ${currencyFormatter.format(value)}`;
  }

  if (promo.adjustmentType === "surcharge") {
    return `Adds ${currencyFormatter.format(value)}`;
  }

  return "No price change";
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
    roomType: "",
    promo: "",
    paymentMethod: "manual_transfer",
  });
  const [roomOptions, setRoomOptions] = useState([]);
  const [promoOptions, setPromoOptions] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [promosLoading, setPromosLoading] = useState(true);
  const [statusCode, setStatusCode] = useState("");
  const [proofImage, setProofImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [bookingResult, setBookingResult] = useState(null);
  const [availabilityResult, setAvailabilityResult] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => getMonthStart());
  const [availabilityCalendar, setAvailabilityCalendar] = useState(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState("");
  const [invoice, setInvoice] = useState(null);

  const selectedRoom = useMemo(
    () => roomOptions.find((room) => room.type === form.roomType) || roomOptions[0] || null,
    [form.roomType, roomOptions]
  );
  const selectedPromo = useMemo(
    () => promoOptions.find((promo) => promo._id === form.promo) || null,
    [form.promo, promoOptions]
  );

  const nights = getNights(form.checkIn, form.checkOut);
  const adultGuests = Number(form.guests);
  const childGuests = Number(form.children);
  const subtotal = nights * (selectedRoom?.pricePerNight || 0);
  const totalAmount = Math.max(0, Math.round(applyPromoPricing(subtotal, selectedPromo)));
  const calendarCells = useMemo(
    () => buildCalendarCells(calendarMonth, availabilityCalendar?.dates || []),
    [availabilityCalendar, calendarMonth]
  );

  useEffect(() => {
    let ignore = false;

    const loadRoomTypes = async () => {
      setRoomsLoading(true);

      try {
        const response = await roomApi.listTypes();
        const options = (response.data || []).map((roomType) => ({
          type: roomType.roomType,
          roomType: roomType.label || roomType.roomType,
          capacity: roomType.adultCapacity || 1,
          childCapacity: roomType.childCapacity || 0,
          pricePerNight: roomType.basePrice || 0,
          availableUnits: roomType.availableUnits || 0,
        }));

        if (!ignore) {
          setRoomOptions(options);
          setForm((previous) => ({
            ...previous,
            roomType: previous.roomType || options[0]?.type || "",
          }));
        }
      } catch (roomTypeError) {
        if (!ignore) {
          setError(normalizeError(roomTypeError));
        }
      } finally {
        if (!ignore) {
          setRoomsLoading(false);
        }
      }
    };

    loadRoomTypes();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    const loadPromos = async () => {
      setPromosLoading(true);

      try {
        const response = await promoApi.listActive();

        if (!ignore) {
          setPromoOptions(response.data || []);
        }
      } catch {
        if (!ignore) {
          setPromoOptions([]);
        }
      } finally {
        if (!ignore) {
          setPromosLoading(false);
        }
      }
    };

    loadPromos();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    const loadAvailabilityCalendar = async () => {
      if (!form.roomType) {
        setAvailabilityCalendar(null);
        setCalendarError("");
        return;
      }

      setCalendarLoading(true);
      setCalendarError("");

      try {
        const response = await roomApi.getAvailabilityCalendar({
          roomType: form.roomType,
          startDate: toDateInput(getMonthStart(calendarMonth)),
          endDate: toDateInput(getMonthEnd(calendarMonth)),
        });

        if (!ignore) {
          setAvailabilityCalendar(response.data);
        }
      } catch (calendarLoadError) {
        if (!ignore) {
          setAvailabilityCalendar(null);
          setCalendarError(normalizeError(calendarLoadError));
        }
      } finally {
        if (!ignore) {
          setCalendarLoading(false);
        }
      }
    };

    loadAvailabilityCalendar();

    return () => {
      ignore = true;
    };
  }, [calendarMonth, form.roomType]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));

    if (["roomType", "checkIn", "checkOut"].includes(name)) {
      setAvailabilityResult(null);
    }
  };

  const handleCalendarDateClick = (day) => {
    if (!day) {
      return;
    }

    setAvailabilityResult(null);
    setForm((previous) => {
      const canUseAsCheckout =
        previous.checkIn && !previous.checkOut && day.date > previous.checkIn;

      if (!day.isAvailable && !canUseAsCheckout) {
        return previous;
      }

      if (!previous.checkIn || previous.checkOut || day.date <= previous.checkIn) {
        return {
          ...previous,
          checkIn: day.date,
          checkOut: "",
        };
      }

      return {
        ...previous,
        checkOut: day.date,
      };
    });
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

    if (!selectedRoom) {
      return "No room types are available yet. Please contact admin or try again later.";
    }

    if (adultGuests <= 0) {
      return "Please enter at least one adult guest.";
    }

    if (adultGuests > selectedRoom.capacity) {
      return `${selectedRoom.roomType} can host up to ${selectedRoom.capacity} adult guests.`;
    }

    if (childGuests > selectedRoom.childCapacity) {
      return `${selectedRoom.roomType} can host up to ${selectedRoom.childCapacity} children.`;
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

    if (!selectedRoom) {
      setError("No room types are available yet.");
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
        numberOfGuests: adultGuests,
        numberOfChildren: childGuests,
        totalAmount,
        promoId: selectedPromo?._id || undefined,
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
      <div id="availability-calendar" className="mx-auto mb-8 max-w-4xl scroll-mt-24 rounded-xl border border-green-100 bg-cream p-4 text-left shadow-md md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-green-700">
              Availability
            </p>
            <h2 className="mt-1 text-xl font-bold text-forest">
              {monthFormatter.format(calendarMonth)}
            </h2>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              name="roomType"
              value={form.roomType}
              onChange={handleChange}
              className="min-h-10 rounded border border-green-100 bg-white px-3 py-2 text-sm text-forest"
              disabled={roomsLoading || roomOptions.length === 0}
              aria-label="Availability room type"
            >
              {roomOptions.length === 0 ? (
                <option value="">
                  {roomsLoading ? "Loading room types..." : "No room types available"}
                </option>
              ) : null}
              {roomOptions.map((room) => (
                <option key={room.type} value={room.type}>
                  {room.roomType}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCalendarMonth((previous) => shiftMonth(previous, -1))}
                className="flex h-10 w-10 items-center justify-center rounded border border-green-100 bg-white text-forest transition hover:bg-green-50"
                aria-label="Previous month"
              >
                <FiChevronLeft aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setCalendarMonth((previous) => shiftMonth(previous, 1))}
                className="flex h-10 w-10 items-center justify-center rounded border border-green-100 bg-white text-forest transition hover:bg-green-50"
                aria-label="Next month"
              >
                <FiChevronRight aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-gray-600">
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-green-100 ring-1 ring-green-200" />
            Available
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-red-50 ring-1 ring-red-100" />
            Full
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-forest" />
            Selected
          </span>
          {availabilityCalendar ? (
            <span className="ml-auto text-gray-500">
              {availabilityCalendar.totalRooms} unit(s)
            </span>
          ) : null}
        </div>

        {calendarError ? (
          <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {calendarError}
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-500">
          {calendarWeekdays.map((weekday) => (
            <div key={weekday} className="py-2">
              {weekday}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {calendarCells.map((day, index) => {
            if (!day) {
              return (
                <div
                  key={`empty-${index}`}
                  className="min-h-[4.75rem] rounded border border-transparent"
                />
              );
            }

            const isCheckIn = day.date === form.checkIn;
            const isCheckOut = day.date === form.checkOut;
            const isInRange =
              form.checkIn &&
              form.checkOut &&
              day.date > form.checkIn &&
              day.date < form.checkOut;
            const canSelectAsCheckout =
              form.checkIn && !form.checkOut && day.date > form.checkIn;
            const selectable = day.isAvailable || canSelectAsCheckout;
            const selectedClasses =
              isCheckIn || isCheckOut
                ? "border-forest bg-forest text-white shadow"
                : isInRange
                  ? "border-green-200 bg-green-100 text-forest"
                  : day.totalRooms === 0
                    ? "border-gray-100 bg-gray-50 text-gray-400"
                    : day.isAvailable
                      ? "border-green-200 bg-white text-forest hover:border-forest hover:bg-green-50"
                      : canSelectAsCheckout
                        ? "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300"
                        : "border-red-100 bg-red-50 text-red-400";

            return (
              <button
                key={day.date}
                type="button"
                onClick={() => handleCalendarDateClick(day)}
                disabled={!selectable}
                className={`flex min-h-[4.75rem] flex-col justify-between rounded border p-2 text-left text-xs transition disabled:cursor-default ${selectedClasses}`}
                aria-label={`${day.date}, ${day.availableCount} units available`}
              >
                <span className="text-sm font-bold">{day.dayNumber}</span>
                <span className="leading-tight">
                  {day.totalRooms > 0
                    ? `${day.availableCount}/${day.totalRooms} unit`
                    : "-"}
                </span>
              </button>
            );
          })}
        </div>

        {calendarLoading ? (
          <p className="mt-3 text-sm text-gray-500">Loading availability...</p>
        ) : null}
      </div>

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
            disabled={roomsLoading || roomOptions.length === 0}
          >
            {roomOptions.length === 0 ? (
              <option value="">
                {roomsLoading ? "Loading room types..." : "No room types available"}
              </option>
            ) : null}
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
            disabled={promosLoading}
          >
            <option value="">
              {promosLoading ? "Loading promos..." : "No Promo"}
            </option>
            {promoOptions.map((promo) => (
              <option key={promo._id} value={promo._id}>
                {promo.name} ({formatPromoRule(promo)})
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 rounded border bg-white p-4 text-sm text-gray-700">
          <div className="grid gap-2 md:grid-cols-4">
            <p>
              <span className="font-semibold text-forest">Room:</span>{" "}
              {selectedRoom?.roomType || "-"}
            </p>
            <p>
              <span className="font-semibold text-forest">Adults:</span>{" "}
              {selectedRoom?.capacity ?? "-"}
            </p>
            <p>
              <span className="font-semibold text-forest">Children:</span>{" "}
              {selectedRoom?.childCapacity ?? "-"}
            </p>
            <p>
              <span className="font-semibold text-forest">Nights:</span> {nights}
            </p>
            <p>
              <span className="font-semibold text-forest">Total:</span>{" "}
              {currencyFormatter.format(totalAmount)}
            </p>
          </div>
          {selectedPromo ? (
            <p className="mt-3 rounded bg-green-50 p-3 text-green-800">
              Promo applied: {selectedPromo.name} · {formatPromoRule(selectedPromo)}
            </p>
          ) : null}
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
                ? `${availabilityResult.availableCount} ${(selectedRoom?.roomType || "room").toLowerCase()} unit(s) available for these dates.`
                : `No ${(selectedRoom?.roomType || "room").toLowerCase()} units available for these dates.`}
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
          disabled={loading || roomsLoading || roomOptions.length === 0}
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
