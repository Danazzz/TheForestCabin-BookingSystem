import { useEffect, useState } from "react";

const images = [
  "public/gallery/IMG_0743.jpg",
  "public/gallery/IMG_0748.jpg",
  "public/gallery/IMG_0750.jpg",
];

export default function Gallery() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % images.length);
    }, 3000); // 3 detik

    return () => clearInterval(interval);
  }, []);

  return (
    <section id="gallery" className="py-12 bg-cream text-center">
      <h2 className="text-2xl font-bold text-forest mb-6">
        Gallery
      </h2>

      <div className="relative w-full max-w-4xl mx-auto overflow-hidden rounded-xl shadow-lg">

        {/* Images */}
        <div
          className="flex transition-transform duration-700 ease-in-out"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {images.map((img, index) => (
            <img
              key={index}
              src={img}
              className="w-full h-64 md:h-96 object-cover flex-shrink-0"
            />
          ))}
        </div>

        {/* Indicator dots */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>

        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
          {images.map((_, i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full ${
                i === current ? "bg-white" : "bg-white/50"
              }`}
            />
          ))}
        </div>

      </div>
    </section>
  );
}