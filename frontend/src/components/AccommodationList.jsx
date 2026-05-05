import { useEffect, useState } from "react";
import AccommodationCard from "./AccommodationCard";
import { accommodations } from "../data/accommodations";
import { contentApi } from "../services/api";

export default function AccommodationList() {
  const [activeIndex, setActiveIndex] = useState(null);
  const [items, setItems] = useState(accommodations);

  useEffect(() => {
    let ignore = false;

    const loadAccommodations = async () => {
      try {
        const response = await contentApi.list("accommodation");
        const nextItems = (response.data || []).map((item) => ({
          id: item._id,
          name: item.title,
          image: item.imageUrl || "/gallery/IMG_0748.jpg",
          description: item.description,
          details: item.details || [],
          altText: item.altText,
        }));

        if (!ignore && nextItems.length > 0) {
          setItems(nextItems);
        }
      } catch {
        if (!ignore) {
          setItems(accommodations);
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
    </section>
  );
}
