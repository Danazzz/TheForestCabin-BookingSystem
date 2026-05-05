import { useEffect, useState } from "react";
import { contentApi } from "../services/api";

const fallbackImages = [
  {
    id: "gallery-0743",
    imageUrl: "/gallery/IMG_0743.jpg",
    title: "Forest Cabin gallery",
  },
  {
    id: "gallery-0748",
    imageUrl: "/gallery/IMG_0748.jpg",
    title: "Forest Cabin gallery",
  },
  {
    id: "gallery-0750",
    imageUrl: "/gallery/IMG_0750.jpg",
    title: "Forest Cabin gallery",
  },
];

export default function Gallery() {
  const [images, setImages] = useState(fallbackImages);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let ignore = false;

    const loadGallery = async () => {
      try {
        const response = await contentApi.list("gallery");
        const nextImages = (response.data || []).map((item) => ({
          id: item._id,
          imageUrl: item.imageUrl,
          title: item.title,
          altText: item.altText,
        })).filter((item) => item.imageUrl);

        if (!ignore && nextImages.length > 0) {
          setImages(nextImages);
          setCurrent(0);
        }
      } catch {
        if (!ignore) {
          setImages(fallbackImages);
        }
      }
    };

    loadGallery();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (images.length <= 1) {
      return undefined;
    }

    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % images.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [images.length]);

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
          {images.map((image, index) => (
            <img
              key={image.id || index}
              src={image.imageUrl}
              alt={image.altText || image.title || "Forest Cabin gallery"}
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
