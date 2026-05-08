import { useEffect, useState } from "react";
import { promoApi } from "../services/api";
import { sanitizeMediaUrl } from "../utils/security";

export default function PromoCarousel() {
  const [promos, setPromos] = useState([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let ignore = false;

    const loadPromos = async () => {
      try {
        const response = await promoApi.listActive();
        const activePromos = (response.data || []).map((promo) => ({
          ...promo,
          imageUrl: sanitizeMediaUrl(promo.imageUrl),
        }));

        if (!ignore && activePromos.length > 0) {
          setPromos(activePromos);
          setIndex(0);
        }
      } catch {
        if (!ignore) {
          setPromos([]);
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

      {promos.length === 0 ? (
        <div className="max-w-4xl mx-auto rounded-2xl border border-forest/10 bg-white/70 px-4 py-10 text-center text-sm text-gray-600">
          Special offers will be updated soon.
        </div>
      ) : (
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
              {sanitizeMediaUrl(promo.imageUrl) ? (
                <img
                  src={sanitizeMediaUrl(promo.imageUrl)}
                  alt={promo.altText || promo.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-forest" />
              )}

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
      )}
    </section>
  );
}
