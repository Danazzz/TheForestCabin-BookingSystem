import { useEffect, useState } from "react";

export default function PromoCarousel() {
  const promos = [
    {
      title: "🌿 Stay 3 Nights, Get 20% OFF",
      desc: "Perfect for a relaxing long weekend in nature",
      image: "/cabin.jpg",
    },
    {
      title: "💑 Honeymoon Package",
      desc: "Romantic setup with special forest view",
      image: "/cabin.jpg",
    },
    {
      title: "👨‍👩‍👧 Family Getaway",
      desc: "Spacious cabins for your whole family",
      image: "/cabin.jpg",
    },
  ];

  const [index, setIndex] = useState(0);

  // AUTO SLIDE
  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % promos.length);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-10 px-4 bg-cream">
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
                src={promo.image}
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
                  {promo.desc}
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