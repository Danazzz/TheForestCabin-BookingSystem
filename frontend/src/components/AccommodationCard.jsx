import { useState } from "react";
import { sanitizeMediaUrl } from "../utils/security";

export default function AccommodationCard({
  item,
  isActive,
  onToggle,
}) {
  const details = item.details || [];
  const galleryImages = (item.images || [])
    .map((image) => ({
      url: sanitizeMediaUrl(image.url || image.imageUrl || image),
      altText: image.altText || item.altText || item.name,
    }))
    .filter((image) => image.url);
  const imageUrl = galleryImages[0]?.url || sanitizeMediaUrl(item.image);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const openGallery = () => {
    if (!galleryImages.length) {
      return;
    }

    setCurrentImageIndex(0);
    setIsGalleryOpen(true);
  };

  const showPreviousImage = () => {
    setCurrentImageIndex((current) => (
      current === 0 ? galleryImages.length - 1 : current - 1
    ));
  };

  const showNextImage = () => {
    setCurrentImageIndex((current) => (current + 1) % galleryImages.length);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl bg-white shadow-md transition duration-300">

      {imageUrl ? (
        <button
          type="button"
          onClick={openGallery}
          className="group block w-full overflow-hidden border-0 bg-transparent p-0 text-left"
          aria-label={`Open ${item.name} photo gallery`}
        >
          <img
            src={imageUrl}
            alt={item.altText || item.name}
            className="h-44 md:h-48 w-full object-cover transition duration-300 group-hover:scale-105"
          />
          {galleryImages.length > 1 ? (
            <span className="absolute sr-only">{galleryImages.length} photos available</span>
          ) : null}
        </button>
      ) : (
        <div className="flex h-44 w-full items-center justify-center bg-cream text-sm text-gray-500 md:h-48">
          Image will be updated soon.
        </div>
      )}

      <div className="flex flex-1 flex-col p-4 text-center">
        <h3 className="text-lg md:text-xl font-semibold text-forest">
          {item.name}
        </h3>

        <p className="mt-3 line-clamp-6 min-h-[8.25rem] text-justify text-sm leading-relaxed text-gray-700">
          {item.description}
        </p>

        <button
          type="button"
          onClick={onToggle}
          className="mx-auto mt-auto inline-flex items-center justify-center rounded bg-wood px-4 py-2 text-xs text-white transition hover:bg-amber-800 md:text-sm"
        >
          {isActive ? "Hide Details" : "View Details"}
        </button>

        {/* DROPDOWN */}
        <div
          className={`overflow-hidden transition-all duration-500 
          ${isActive ? "max-h-40 mt-4" : "max-h-0"}`}
        >
          <div className="text-sm text-gray-700 bg-cream p-3 rounded-lg mt-2">
            <ul className="space-y-1">
              {details.map((d, i) => (
                <li key={i}>• {d}</li>
              ))}
              {details.length === 0 ? <li>Details will be updated soon.</li> : null}
            </ul>
          </div>
        </div>

      </div>

      {isGalleryOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-label={`${item.name} photo gallery`}
        >
          <div className="relative flex w-full max-w-5xl flex-col items-center gap-4">
            <button
              type="button"
              onClick={() => setIsGalleryOpen(false)}
              className="absolute right-0 top-0 rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-forest shadow"
            >
              Close
            </button>

            <img
              src={galleryImages[currentImageIndex]?.url}
              alt={galleryImages[currentImageIndex]?.altText || item.name}
              className="max-h-[78vh] w-full rounded-2xl object-contain"
            />

            <div className="flex w-full max-w-sm items-center justify-between gap-3 text-white">
              <button
                type="button"
                onClick={showPreviousImage}
                disabled={galleryImages.length <= 1}
                className="rounded-full border border-white/40 px-4 py-2 text-sm font-semibold disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm">
                {currentImageIndex + 1} / {galleryImages.length}
              </span>
              <button
                type="button"
                onClick={showNextImage}
                disabled={galleryImages.length <= 1}
                className="rounded-full border border-white/40 px-4 py-2 text-sm font-semibold disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
