import { encodePathSegment } from "../utils/security";

const API_ROOT = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const API_BASE_URL = API_ROOT.endsWith("/api") ? API_ROOT : `${API_ROOT}/api`;

const parseResponse = async (response) => {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.message || "Request failed";
    const error = new Error(message);
    error.status = response.status;
    error.details = payload?.details;
    throw error;
  }

  return payload;
};

const apiRequest = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  return parseResponse(response);
};

export const bookingApi = {
  createBooking: (payload) =>
    apiRequest("/bookings", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getBooking: (bookingId) => apiRequest(`/bookings/${encodePathSegment(bookingId)}`),
  getByCode: (bookingCode) => apiRequest(`/bookings/code/${encodePathSegment(bookingCode)}`),
};

export const roomApi = {
  listRooms: (params = {}) => {
    const search = new URLSearchParams(params).toString();
    return apiRequest(`/rooms${search ? `?${search}` : ""}`);
  },

  listTypes: () => apiRequest("/rooms/types"),

  checkAvailability: (payload) => {
    const search = new URLSearchParams(payload).toString();
    return apiRequest(`/rooms/availability?${search}`);
  },

  getAvailabilityCalendar: (payload) => {
    const search = new URLSearchParams(payload).toString();
    return apiRequest(`/rooms/availability-calendar?${search}`);
  },
};

export const paymentApi = {
  createPayment: (bookingId, payload) =>
    apiRequest(`/payments/${encodePathSegment(bookingId)}/create`, {
      method: "POST",
      body: JSON.stringify(
        typeof payload === "string" ? { paymentMethod: payload } : payload
      ),
    }),

  uploadProof: async (paymentId, file) => {
    const formData = new FormData();
    formData.append("proofImage", file);

    const response = await fetch(`${API_BASE_URL}/payments/${encodePathSegment(paymentId)}/upload-proof`, {
      method: "POST",
      body: formData,
    });

    return parseResponse(response);
  },

  getByBooking: (bookingId) => apiRequest(`/payments/booking/${encodePathSegment(bookingId)}`),
};

export const paymentOptionApi = {
  listActive: () => apiRequest("/payments/options/active"),
};

export const invoiceApi = {
  getByBooking: (bookingId) => apiRequest(`/invoices/booking/${encodePathSegment(bookingId)}`),
};

export const calendarApi = {
  checkAvailability: (payload) =>
    apiRequest("/calendar/check-availability", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export const promoApi = {
  listActive: () => apiRequest("/promos/active"),
};

export const galleryApi = {
  list: () => apiRequest("/gallery"),
};
