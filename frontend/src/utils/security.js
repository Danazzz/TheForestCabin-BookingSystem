export const MAX_PAYMENT_PROOF_SIZE_MB = 5;

const MAX_PAYMENT_PROOF_SIZE_BYTES = MAX_PAYMENT_PROOF_SIZE_MB * 1024 * 1024;
const PAYMENT_PROOF_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const encodePathSegment = (value) =>
  encodeURIComponent(String(value ?? "").trim());

export const sanitizeMediaUrl = (value) => {
  const url = String(value || "").trim();

  if (!url) {
    return "";
  }

  if (url.startsWith("/") && !url.startsWith("//")) {
    return url;
  }

  try {
    const parsedUrl = new URL(url);

    return ["http:", "https:"].includes(parsedUrl.protocol) ? parsedUrl.href : "";
  } catch {
    return "";
  }
};

export const validatePaymentProofFile = (file) => {
  if (!file) {
    return "Please choose a payment proof image first.";
  }

  if (!PAYMENT_PROOF_ALLOWED_TYPES.includes(file.type)) {
    return "Payment proof must be a JPG, PNG, or WEBP image.";
  }

  if (file.size > MAX_PAYMENT_PROOF_SIZE_BYTES) {
    return `Payment proof must be ${MAX_PAYMENT_PROOF_SIZE_MB} MB or smaller.`;
  }

  return "";
};
