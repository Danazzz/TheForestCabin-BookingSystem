import { useState } from "react";
import AccommodationCard from "./AccommodationCard";
import { accommodations } from "../data/accommodations";

export default function AccommodationList() {
  const [activeIndex, setActiveIndex] = useState(null);

  return (
    <section id="accommodations" className="py-12 px-4 md:px-6">

      <h2 className="text-2xl md:text-3xl font-bold text-center text-forest mb-8">
        Our Accommodations
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {accommodations.map((item, index) => (
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