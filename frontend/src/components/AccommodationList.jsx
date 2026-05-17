import { useEffect, useState } from "react";
import AccommodationCard from "./AccommodationCard";
import { roomApi } from "../services/api";
import { sanitizeMediaUrl } from "../utils/security";

export default function AccommodationList() {
  const [activeIndex, setActiveIndex] = useState(null);
  const [items, setItems] = useState([]);

  useEffect(() => {
    let ignore = false;

    const loadAccommodations = async () => {
      try {
        const response = await roomApi.listTypes();
        const nextItems = (response.data || []).map((item) => {
          const images = (item.images || [])
            .map((image) => ({
              url: sanitizeMediaUrl(image.url || image.imageUrl),
              altText: image.altText || item.altText || item.label || item.roomType,
            }))
            .filter((image) => image.url);
          const fallbackImage = sanitizeMediaUrl(item.imageUrl);
          const galleryImages = images.length > 0
            ? images
            : fallbackImage
              ? [{ url: fallbackImage, altText: item.altText || item.label || item.roomType }]
              : [];

          return {
            id: item.roomType,
            name: item.label || item.roomType,
            image: galleryImages[0]?.url || "",
            images: galleryImages,
            description: item.description,
            details: item.details || [],
            altText: item.altText,
          };
        });

        if (!ignore) {
          setItems(nextItems);
        }
      } catch {
        if (!ignore) {
          setItems([]);
        }
      }
    };

    loadAccommodations();

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <section id="accommodations" className="py-12 px-4 md:px-6 scroll-mt-24">

      <h2 className="text-2xl md:text-3xl font-bold text-center text-forest mb-8">
        Our Accommodations
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {items.map((item, index) => (
          <AccommodationCard
            key={item.id}
            item={item}
            isActive={activeIndex === index}
            onToggle={() =>
              setActiveIndex(activeIndex === index ? null : index)
            }
          />
        ))}

      </div>

      {items.length === 0 ? (
        <div className="mx-auto max-w-3xl rounded-xl border border-forest/10 bg-white/70 px-4 py-10 text-center text-sm text-gray-600">
          Accommodations will be updated soon.
        </div>
      ) : null}
    </section>
  );
}
