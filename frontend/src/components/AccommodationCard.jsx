import { sanitizeMediaUrl } from "../utils/security";

export default function AccommodationCard({
  item,
  isActive,
  onToggle,
}) {
  const details = item.details || [];
  const imageUrl = sanitizeMediaUrl(item.image);

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-md transition duration-300">

      {imageUrl ? (
        <img
          src={imageUrl}
          alt={item.altText || item.name}
          className="h-44 md:h-48 w-full object-cover"
        />
      ) : (
        <div className="flex h-44 w-full items-center justify-center bg-cream text-sm text-gray-500 md:h-48">
          Image will be updated soon.
        </div>
      )}

      <div className="p-4 text-left">
        <h3 className="text-lg md:text-xl font-semibold text-forest">
          {item.name}
        </h3>

        <p className="text-gray-60 mt-2 text-sm">
          {item.description}
        </p>

        <button
          onClick={onToggle}
          className="mt-4 text-xs md:text-sm text-white bg-wood px-4 py-2 rounded hover:bg-amber-800 transition"
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
    </div>
  );
}
