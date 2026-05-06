import { useEffect, useMemo, useRef, useState } from "react";
import { FiChevronLeft, FiChevronRight, FiCopy } from "react-icons/fi";
import {
  bookingApi,
  invoiceApi,
  paymentApi,
  paymentOptionApi,
  promoApi,
  roomApi,
} from "../services/api";

const PROPERTY_ID = "forest-cabin-main";

const paymentMethodLabels = {
  manual_transfer: "Transfer Rekening",
  virtual_account: "Virtual Account",
  qris: "QRIS",
  other: "Other",
};

const paymentMethodPriority = {
  manual_transfer: 1,
  virtual_account: 2,
  qris: 3,
  other: 4,
};

const bookingStatusLabels = {
  waiting_availability_approval: "Waiting for admin availability review",
  pending_payment: "Approved, waiting for payment",
  waiting_admin_approval: "Waiting for payment proof review",
  success: "Confirmed",
  rejected: "Rejected",
  cancelled: "Cancelled",
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

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Makassar",
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

const formatRoomType = (roomType) =>
  String(roomType || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const getBookingStatusLabel = (status) => bookingStatusLabels[status] || status || "-";
const formatDateTime = (value) => (value ? `${dateTimeFormatter.format(new Date(value))} WITA` : "-");

const getPaymentOptionSummary = (paymentOption) => {
  if (!paymentOption) {
    return "";
  }

  if (paymentOption.paymentMethod === "qris") {
    return paymentOption.merchantName || "QRIS merchant";
  }

  if (paymentOption.paymentMethod === "virtual_account") {
    return `${paymentOption.bankName || "Virtual Account"} ${paymentOption.accountNumber || ""}`.trim();
  }

  if (paymentOption.paymentMethod === "other") {
    return paymentOption.accountNumber || paymentOption.accountName || "Custom payment";
  }

  return `${paymentOption.bankName || "Bank transfer"} ${paymentOption.accountNumber || ""}`.trim();
};

const getPaymentOptionDisplayName = (paymentOption) => {
  if (!paymentOption) {
    return "-";
  }

  if (paymentOption.paymentMethod === "manual_transfer") {
    return `Transfer Rekening ${paymentOption.bankName || ""}`.trim();
  }

  if (paymentOption.paymentMethod === "virtual_account") {
    return `Virtual Account ${paymentOption.bankName || ""}`.trim();
  }

  if (paymentOption.paymentMethod === "qris") {
    return `QRIS ${paymentOption.merchantName || ""}`.trim();
  }

  return paymentOption.merchantName || paymentOption.bankName || paymentOption.name || "Other Payment";
};

const sortPaymentOptions = (options) =>
  [...options].sort((first, second) => {
    const priorityDiff =
      (paymentMethodPriority[first.paymentMethod] || 99) -
      (paymentMethodPriority[second.paymentMethod] || 99);

    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return getPaymentOptionDisplayName(first).localeCompare(getPaymentOptionDisplayName(second));
  });

const getPaymentDetails = (paymentData) => {
  if (!paymentData) {
    return null;
  }

  return {
    name: getPaymentOptionDisplayName(paymentData),
    paymentMethod: paymentData.paymentMethod,
    bankName: paymentData.bankName,
    accountName: paymentData.accountName,
    accountNumber: paymentData.virtualAccountNumber || paymentData.accountNumber,
    merchantName: paymentData.merchantName,
    qrisCode: paymentData.qrisCode || paymentData.qrString,
    imageUrl: paymentData.qrImageUrl || paymentData.imageUrl,
    instructions: paymentData.instructions,
  };
};

const copyToClipboard = async (value) => {
  if (!value || !navigator.clipboard) {
    return false;
  }

  await navigator.clipboard.writeText(value);
  return true;
};

const getInitialBookingCode = () => {
  const bookingCode = new URLSearchParams(window.location.search).get("bookingCode");

  return bookingCode ? bookingCode.trim().toUpperCase() : "";
};

export default function BookingSection({ highlight }) {
  const autoLoadedStatusRef = useRef(false);
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
    paymentOptionId: "",
  });
  const [roomOptions, setRoomOptions] = useState([]);
  const [promoOptions, setPromoOptions] = useState([]);
  const [paymentOptions, setPaymentOptions] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [promosLoading, setPromosLoading] = useState(true);
  const [paymentOptionsLoading, setPaymentOptionsLoading] = useState(true);
  const [statusCode, setStatusCode] = useState(getInitialBookingCode);
  const [proofImage, setProofImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [proofUploading, setProofUploading] = useState(false);
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
  const selectedPaymentOption = useMemo(
    () =>
      paymentOptions.find((paymentOption) => paymentOption._id === form.paymentOptionId) ||
      paymentOptions[0] ||
      null,
    [form.paymentOptionId, paymentOptions]
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

    const loadPaymentOptions = async () => {
      setPaymentOptionsLoading(true);

      try {
        const response = await paymentOptionApi.listActive();
        const options = sortPaymentOptions(response.data || []);

        if (!ignore) {
          setPaymentOptions(options);
          setForm((previous) => ({
            ...previous,
            paymentOptionId: previous.paymentOptionId || options[0]?._id || "",
          }));
        }
      } catch {
        if (!ignore) {
          setPaymentOptions([]);
        }
      } finally {
        if (!ignore) {
          setPaymentOptionsLoading(false);
        }
      }
    };

    loadPaymentOptions();

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
        payment: paymentResponse.data?.[0] || null,
      }));

      await loadInvoiceIfAvailable(booking._id);
    } catch (statusError) {
      setError(normalizeError(statusError));
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    const initialBookingCode = getInitialBookingCode();

    if (!initialBookingCode || autoLoadedStatusRef.current) {
      return () => {
        ignore = true;
      };
    }

    autoLoadedStatusRef.current = true;
    setRefreshing(true);
    setError("");

    const loadInitialStatus = async () => {
      try {
        const bookingResponse = await bookingApi.getByCode(initialBookingCode);
        const booking = bookingResponse.data;
        const paymentResponse = await paymentApi.getByBooking(booking._id);

        if (ignore) {
          return;
        }

        setBookingResult({
          booking,
          payments: paymentResponse.data,
          payment: paymentResponse.data?.[0] || null,
          providerPayload: null,
        });

        try {
          const invoiceResponse = await invoiceApi.getByBooking(booking._id);

          if (!ignore) {
            setInvoice(invoiceResponse.data);
          }
        } catch (invoiceError) {
          if (!ignore && invoiceError.status !== 404) {
            setError(normalizeError(invoiceError));
          }
        }
      } catch (statusError) {
        if (!ignore) {
          setError(normalizeError(statusError));
        }
      } finally {
        if (!ignore) {
          setRefreshing(false);
        }
      }
    };

    loadInitialStatus();

    return () => {
      ignore = true;
    };
  }, []);

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

      setBookingResult({
        booking: createdBooking,
        payment: null,
        payments: [],
        providerPayload: null,
      });
      setStatusCode(createdBooking.bookingCode || "");

      setSuccessMessage(
        `Booking request submitted. Your code is ${createdBooking.bookingCode}. Admin will check availability before payment is opened.`
      );
    } catch (submitError) {
      setError(normalizeError(submitError));
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePayment = async () => {
    if (!bookingResult?.booking?._id) {
      setError("Submit or find a booking first.");
      return;
    }

    if (bookingResult.booking.bookingStatus !== "pending_payment") {
      setError("Payment is available after admin approves room availability.");
      return;
    }

    if (!selectedPaymentOption) {
      setError("No active payment method is available yet. Please contact admin.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const paymentResponse = await paymentApi.createPayment(bookingResult.booking._id, {
        paymentMethod: selectedPaymentOption.paymentMethod,
        paymentOptionId: selectedPaymentOption._id,
      });

      let currentBooking = paymentResponse.data.booking;
      const currentPayment = paymentResponse.data.payment;

      currentBooking = {
        ...currentBooking,
        bookingCode: currentBooking.bookingCode || bookingResult.booking.bookingCode,
        roomId: currentBooking.roomId || bookingResult.booking.roomId,
      };

      setBookingResult({
        booking: currentBooking,
        payment: currentPayment,
        payments: [currentPayment],
        providerPayload: paymentResponse.data.providerPayload,
      });
      setStatusCode(currentBooking.bookingCode || "");

      setSuccessMessage(
        "Payment instructions created. Complete the payment, then upload your payment proof."
      );
    } catch (paymentError) {
      setError(normalizeError(paymentError));
    } finally {
      setLoading(false);
    }
  };

  const handleProofUpload = async () => {
    if (!latestPayment?._id) {
      setError("Create a payment request first.");
      return;
    }

    if (!proofImage) {
      setError("Please choose a payment proof image first.");
      return;
    }

    setProofUploading(true);
    setError("");
    setSuccessMessage("");

    try {
      const uploadResponse = await paymentApi.uploadProof(latestPayment._id, proofImage);
      const uploadedPayment = uploadResponse.data.payment;

      setBookingResult((previous) => ({
        ...previous,
        booking: uploadResponse.data.booking,
        payment: uploadedPayment,
        payments: [
          uploadedPayment,
          ...(previous?.payments || []).filter((payment) => payment._id !== uploadedPayment._id),
        ],
      }));
      setProofImage(null);
      setSuccessMessage("Payment proof uploaded. Your booking is waiting for admin approval.");
    } catch (uploadError) {
      setError(normalizeError(uploadError));
    } finally {
      setProofUploading(false);
    }
  };

  const latestPayment = bookingResult?.payment;
  const providerPayload = bookingResult?.providerPayload;
  const paymentInstructions =
    providerPayload?.paymentInstructions || latestPayment?.paymentOptionSnapshot || null;
  const paymentDetails = getPaymentDetails(paymentInstructions);
  const paymentImageUrl = paymentDetails?.imageUrl;
  const paymentAccountNumber = paymentDetails?.accountNumber;
  const canCreatePayment =
    bookingResult?.booking?.bookingStatus === "pending_payment" &&
    !latestPayment &&
    selectedPaymentOption;
  const canUploadProof =
    latestPayment &&
    latestPayment.paymentStatus !== "paid" &&
    bookingResult?.booking?.bookingStatus !== "success";

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

        <div className="mt-4 rounded border bg-white p-4">
          <p className="text-sm font-semibold text-forest">Payment method</p>
          {!bookingResult?.booking ? (
            <p className="mt-3 rounded bg-cream p-3 text-sm text-gray-700">
              Payment will be opened after admin confirms room availability.
            </p>
          ) : null}
          {bookingResult?.booking?.bookingStatus === "waiting_availability_approval" ? (
            <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Admin is checking availability for your requested dates.
            </p>
          ) : null}
          {["rejected", "cancelled"].includes(bookingResult?.booking?.bookingStatus) ? (
            <p className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              Payment is not available for this booking status.
            </p>
          ) : null}
          {bookingResult?.booking?.bookingStatus === "pending_payment" && latestPayment ? (
            <p className="mt-3 rounded bg-cream p-3 text-sm text-gray-700">
              Payment instructions have been created below.
            </p>
          ) : null}
          {bookingResult?.booking?.bookingStatus === "pending_payment" && !latestPayment ? (
            <>
              {bookingResult.booking.paymentDueAt ? (
                <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Please complete payment before {formatDateTime(bookingResult.booking.paymentDueAt)}.
                </p>
              ) : null}
              {paymentOptionsLoading ? (
                <p className="mt-3 text-sm text-gray-500">Loading payment methods...</p>
              ) : null}
              {!paymentOptionsLoading && paymentOptions.length === 0 ? (
                <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  No active payment method is configured yet.
                </p>
              ) : null}
              <div className="mt-3 space-y-3">
                {paymentOptions.map((paymentOption) => {
              const isSelected = form.paymentOptionId === paymentOption._id;
              const paymentDetails = getPaymentDetails(paymentOption);
              const accountLabel =
                paymentOption.paymentMethod === "virtual_account"
                  ? "Virtual account number"
                  : paymentOption.paymentMethod === "other"
                    ? "Reference"
                    : "Account number";

              return (
                <div
                  key={paymentOption._id}
                  className={`overflow-hidden rounded border text-sm transition ${
                    isSelected
                      ? "border-forest bg-green-50 ring-1 ring-forest"
                      : "border-gray-200 hover:border-green-200"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setForm((previous) => ({
                        ...previous,
                        paymentOptionId: paymentOption._id,
                      }))
                    }
                    className="flex w-full items-start justify-between gap-3 p-3 text-left"
                    aria-expanded={isSelected}
                  >
                    <span className="flex items-start gap-2">
                      <span
                        className={`mt-1 h-4 w-4 rounded-full border ${
                          isSelected ? "border-forest bg-forest" : "border-gray-300"
                        }`}
                        aria-hidden="true"
                      />
                      <span>
                        <span className="block font-semibold text-forest">
                          {getPaymentOptionDisplayName(paymentOption)}
                        </span>
                        <span className="block text-xs text-gray-500">
                          {paymentMethodLabels[paymentOption.paymentMethod]}
                        </span>
                      </span>
                    </span>
                    <span className="text-xs text-gray-600">
                      {getPaymentOptionSummary(paymentOption)}
                    </span>
                  </button>

                  {isSelected ? (
                    <div className="border-t border-green-100 bg-white p-3">
                      {paymentDetails?.imageUrl ? (
                        <img
                          src={paymentDetails.imageUrl}
                          alt={paymentDetails.paymentMethod === "qris" ? "QRIS" : "Payment method"}
                          className="max-h-64 w-full rounded border border-green-100 bg-white object-contain p-2"
                        />
                      ) : null}

                      {paymentDetails?.accountNumber ? (
                        <div className="mt-3 rounded border border-green-100 bg-cream p-3">
                          <p className="text-xs uppercase tracking-wide text-gray-500">
                            {accountLabel}
                          </p>
                          <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <span className="text-lg font-bold text-forest">
                              {paymentDetails.accountNumber}
                            </span>
                            <button
                              type="button"
                              onClick={async () => {
                                const copied = await copyToClipboard(paymentDetails.accountNumber);
                                if (copied) {
                                  setSuccessMessage("Payment number copied.");
                                }
                              }}
                              className="inline-flex min-h-10 items-center justify-center gap-2 rounded border border-forest px-3 py-1 text-sm font-semibold text-forest transition hover:bg-forest hover:text-white"
                            >
                              <FiCopy aria-hidden="true" />
                              Copy
                            </button>
                          </div>
                          <p className="mt-2 text-sm">
                            {paymentDetails.bankName || paymentDetails.merchantName || "-"}
                            {paymentDetails.accountName ? ` · ${paymentDetails.accountName}` : ""}
                          </p>
                        </div>
                      ) : null}

                      {paymentDetails?.qrisCode ? (
                        <div className="mt-3 rounded border border-green-100 bg-cream p-3">
                          <p className="text-xs uppercase tracking-wide text-gray-500">
                            QRIS reference
                          </p>
                          <p className="mt-1 break-all font-semibold text-forest">
                            {paymentDetails.qrisCode}
                          </p>
                        </div>
                      ) : null}

                      {paymentDetails?.instructions ? (
                        <p className="mt-3 whitespace-pre-line text-sm text-gray-700">
                          {paymentDetails.instructions}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
                })}
              </div>
              <button
                type="button"
                onClick={handleCreatePayment}
                disabled={loading || paymentOptionsLoading || paymentOptions.length === 0 || !canCreatePayment}
                className="mt-3 w-full rounded bg-forest py-2 font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {loading ? "Creating payment..." : "Create payment instructions"}
              </button>
            </>
          ) : null}
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
          disabled={
            loading ||
            roomsLoading ||
            roomOptions.length === 0
          }
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
                {bookingResult.booking.roomId?.name ||
                  selectedRoom?.roomType ||
                  formatRoomType(bookingResult.booking.roomType)}
              </p>
              <p>
                <span className="font-semibold text-forest">Booking status:</span>{" "}
                {getBookingStatusLabel(bookingResult.booking.bookingStatus)}
              </p>
              <p>
                <span className="font-semibold text-forest">Payment status:</span>{" "}
                {latestPayment?.paymentStatus || bookingResult.booking.paymentStatus}
              </p>
              {bookingResult.booking.paymentDueAt ? (
                <p>
                  <span className="font-semibold text-forest">Payment deadline:</span>{" "}
                  {formatDateTime(bookingResult.booking.paymentDueAt)}
                </p>
              ) : null}
              <p>
                <span className="font-semibold text-forest">Method:</span>{" "}
                {paymentMethodLabels[latestPayment?.paymentMethod] || "-"}
              </p>
            </div>

            {paymentInstructions ? (
              <div className="mt-3 rounded bg-cream p-3">
                <p className="font-semibold text-forest">
                  {paymentDetails?.name || paymentMethodLabels[latestPayment?.paymentMethod]}
                </p>

                {paymentImageUrl ? (
                  <img
                    src={paymentImageUrl}
                    alt="Payment QRIS"
                    className="mt-3 max-h-72 w-full rounded border border-green-100 bg-white object-contain p-2"
                  />
                ) : null}

                {paymentAccountNumber ? (
                  <div className="mt-3 rounded border border-green-100 bg-white p-3">
                    <p className="text-xs uppercase tracking-wide text-gray-500">
                      {latestPayment?.paymentMethod === "virtual_account"
                        ? "Virtual account number"
                        : latestPayment?.paymentMethod === "other"
                          ? "Reference"
                        : "Account number"}
                    </p>
                    <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-lg font-bold text-forest">
                        {paymentAccountNumber}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          const copied = await copyToClipboard(paymentAccountNumber);
                          if (copied) {
                            setSuccessMessage("Payment number copied.");
                          }
                        }}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded border border-forest px-3 py-1 text-sm font-semibold text-forest transition hover:bg-forest hover:text-white"
                      >
                        <FiCopy aria-hidden="true" />
                        Copy
                      </button>
                    </div>
                    <p className="mt-2 text-sm">
                      {paymentDetails?.bankName || paymentDetails?.merchantName || "-"}
                      {paymentDetails?.accountName
                        ? ` · ${paymentDetails.accountName}`
                        : ""}
                    </p>
                  </div>
                ) : null}

                {paymentDetails?.qrisCode ? (
                  <div className="mt-3 rounded border border-green-100 bg-white p-3">
                    <p className="text-xs uppercase tracking-wide text-gray-500">
                      QRIS reference
                    </p>
                    <p className="mt-1 break-all font-semibold text-forest">
                      {paymentDetails.qrisCode}
                    </p>
                  </div>
                ) : null}

                {paymentDetails?.instructions ? (
                  <p className="mt-3 whitespace-pre-line text-sm text-gray-700">
                    {paymentDetails.instructions}
                  </p>
                ) : null}
              </div>
            ) : null}

            {latestPayment?.proofImageUrl ? (
              <div className="mt-3 rounded border border-green-200 bg-green-50 p-3">
                <p className="font-semibold text-forest">Payment proof uploaded</p>
                <a href={latestPayment.proofImageUrl} target="_blank" rel="noreferrer" className="mt-2 block text-green-800 underline">
                  View uploaded proof
                </a>
              </div>
            ) : null}

            {canUploadProof ? (
              <div className="mt-3 rounded border border-green-100 bg-white p-3">
                <p className="font-semibold text-forest">Upload payment proof</p>
                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => setProofImage(event.target.files?.[0] || null)}
                    className="rounded border bg-white p-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleProofUpload}
                    disabled={proofUploading}
                    className="rounded bg-forest px-4 py-2 font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                  >
                    {proofUploading ? "Uploading..." : "Submit Proof"}
                  </button>
                </div>
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
                <p>
                  <span className="font-semibold text-forest">Email:</span>{" "}
                  {invoice.emailStatus || "pending"}
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
