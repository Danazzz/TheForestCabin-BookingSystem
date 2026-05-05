import { useEffect, useState } from "react";
import { promoApi } from "../services/api";

const fallbackPromos = [
  {
    title: "Stay 3 Nights, Get 20% OFF",
    description: "Perfect for a relaxing long weekend in nature",
    imageUrl: "/gallery/IMG_0743.jpg",
  },
  {
    title: "Honeymoon Package",
    description: "Romantic setup with special forest view",
    imageUrl: "/gallery/IMG_0750.jpg",
  },
  {
    title: "Family Getaway",
    description: "Spacious cabins for your whole family",
    imageUrl: "/gallery/IMG_0748.jpg",
  },
];

export default function PromoCarousel() {
  const [promos, setPromos] = useState(fallbackPromos);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let ignore = false;

    const loadPromos = async () => {
      try {
        const response = await promoApi.listActive();
        const activePromos = response.data || [];

        if (!ignore && activePromos.length > 0) {
          setPromos(activePromos);
          setIndex(0);
        }
      } catch {
        if (!ignore) {
          setPromos(fallbackPromos);
        }
      }
    };

    loadPromos();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (promos.length <= 1) {
      return undefined;
    }

    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % promos.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [promos.length]);

  return (
    <section id="promo" className="py-10 px-4 bg-cream scroll-mt-24">
      <h2 className="text-2xl font-bold text-center text-forest mb-6">
        Special Offers
      </h2>

      <div className="max-w-4xl mx-auto relative overflow-hidden rounded-2xl shadow-lg">

        {/* SLIDES */}
        <div
          className="flex transition-transform duration-700"
          style={{
            transform: `translateX(-${index * 100}%)`,
          }}
        >
          {promos.map((promo, i) => (
            <div
              key={i}
              className="min-w-full relative h-56 md:h-72"
            >
              {/* IMAGE */}
              <img
                src={promo.imageUrl || "/gallery/IMG_0743.jpg"}
                alt={promo.altText || promo.title}
                className="w-full h-full object-cover"
              />

              {/* OVERLAY */}
              <div className="absolute inset-0 bg-black/50" />

              {/* TEXT */}
              <div className="absolute inset-0 flex flex-col justify-center items-center text-center text-white px-4">
                <h3 className="text-lg md:text-2xl font-bold">
                  {promo.title}
                </h3>
                <p className="mt-2 text-sm md:text-base text-cream">
                  {promo.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* DOT INDICATOR */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
          {promos.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${
                i === index ? "bg-white" : "bg-white/40"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
