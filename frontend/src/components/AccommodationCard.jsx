import { useState } from "react";
import { sanitizeMediaUrl } from "../utils/security";

export default function AccommodationCard({ item }) {
  const details = item.details || [];
  const galleryImages = (item.images || [])
    .map((image) => ({
      url: sanitizeMediaUrl(image.url || image.imageUrl || image),
      altText: image.altText || item.altText || item.name,
    }))
    .filter((image) => image.url);
  const imageUrl = galleryImages[0]?.url || sanitizeMediaUrl(item.image);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const hasMultipleImages = galleryImages.length > 1;

  const openDetails = () => {
    setCurrentImageIndex(0);
    setIsDetailOpen(true);
  };

  const showPreviousImage = () => {
    setCurrentImageIndex((current) => (
      current === 0 ? galleryImages.length - 1 : current - 1
    ));
  };

  const showNextImage = () => {
    setCurrentImageIndex((current) => (current + 1) % galleryImages.length);
  };

  const handleCardKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDetails();
    }
  };

  return (
    <>
      <div
        className="group flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-2xl bg-white shadow-md transition duration-300 hover:-translate-y-1 hover:shadow-lg"
        role="button"
        tabIndex={0}
        onClick={openDetails}
        onKeyDown={handleCardKeyDown}
        aria-label={`View details for ${item.name}`}
      >

        {imageUrl ? (
          <div className="relative block w-full overflow-hidden">
          <img
            src={imageUrl}
            alt={item.altText || item.name}
            className="h-44 md:h-48 w-full object-cover transition duration-300 group-hover:scale-105"
          />
          {galleryImages.length > 1 ? (
            <span className="absolute sr-only">{galleryImages.length} photos available</span>
          ) : null}
          </div>
        ) : (
          <div className="flex h-44 w-full items-center justify-center bg-cream text-sm text-gray-500 md:h-48">
            Image will be updated soon.
          </div>
        )}

        <div className="flex flex-1 flex-col p-4 text-center">
          <h3 className="text-lg md:text-xl font-semibold text-forest">
            {item.name}
          </h3>

          <p className="mt-3 line-clamp-4 min-h-[5.5rem] text-sm leading-relaxed text-gray-700">
            {item.description}
          </p>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              openDetails();
            }}
            className="mx-auto mt-auto inline-flex items-center justify-center rounded bg-wood px-4 py-2 text-xs text-white transition hover:bg-amber-800 md:text-sm"
          >
            View Details
          </button>
        </div>
      </div>

      {isDetailOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-label={`${item.name} room details`}
          onClick={() => setIsDetailOpen(false)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsDetailOpen(false)}
              className="absolute right-3 top-3 z-10 rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-forest shadow"
            >
              Close
            </button>

            <div className="max-h-[90vh] overflow-y-auto">
              <div className="relative bg-cream">
                {galleryImages.length ? (
                  <img
                    src={galleryImages[currentImageIndex]?.url}
                    alt={galleryImages[currentImageIndex]?.altText || item.name}
                    className="h-64 w-full object-cover sm:h-80 md:h-[26rem]"
                  />
                ) : (
                  <div className="flex h-64 w-full items-center justify-center text-sm text-gray-500 sm:h-80 md:h-[26rem]">
                    Image will be updated soon.
                  </div>
                )}

                {hasMultipleImages ? (
                  <>
                    <button
                      type="button"
                      onClick={showPreviousImage}
                      className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl font-semibold text-forest shadow"
                      aria-label="Previous room photo"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={showNextImage}
                      className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl font-semibold text-forest shadow"
                      aria-label="Next room photo"
                    >
                      ›
                    </button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white">
                      {currentImageIndex + 1} / {galleryImages.length}
                    </div>
                  </>
                ) : null}
              </div>

              <div className="p-5 sm:p-6">
                <h3 className="text-center text-2xl font-semibold text-forest md:text-3xl">
                  {item.name}
                </h3>

                <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs font-semibold text-forest md:text-sm">
                  {item.adultCapacity !== undefined ? (
                    <span className="rounded-full bg-cream px-3 py-1">
                      Up to {item.adultCapacity} adults
                    </span>
                  ) : null}
                  {item.childCapacity !== undefined ? (
                    <span className="rounded-full bg-cream px-3 py-1">
                      Up to {item.childCapacity} children
                    </span>
                  ) : null}
                  {item.availableUnits ? (
                    <span className="rounded-full bg-cream px-3 py-1">
                      {item.availableUnits} unit{item.availableUnits > 1 ? "s" : ""}
                    </span>
                  ) : null}
                </div>

                <p className="mt-5 text-left text-sm leading-7 text-gray-700 md:text-base">
                  {item.description || "Room description will be updated soon."}
                </p>

                {details.length ? (
                  <div className="mt-5 rounded-xl bg-cream p-4">
                    <p className="text-sm font-semibold text-forest">Room details</p>
                    <ul className="mt-3 space-y-2 text-left text-sm leading-relaxed text-gray-700">
                      {details.map((detail, index) => (
                        <li key={`${detail}-${index}`}>• {detail}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
