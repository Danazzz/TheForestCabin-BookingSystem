export default function Navbar() {
  return (
    <div className="w-full bg-forest text-white shadow-md fixed top-0 z-50">
      
      <div className="max-w-6xl mx-auto flex justify-between items-center px-6 py-4">

        <a href="#home" className="flex items-center">
          <img
            src="/logo/The Forest Cabin White.PNG"
            alt="Forest Cabin Logo"
            className="h-10 object-contain hover:scale-105 transition duration-300"
          />
        </a>

        <div className="flex gap-6 text-sm font-medium">
          <a href="#promo" className="hover:text-cream">Promotions</a>
          <a href="#accommodations" className="hover:text-cream">Accommodations</a>
          <a href="#gallery" className="hover:text-cream">Gallery</a>
          <a href="#footer" className="hover:text-cream">Contact Us</a>
        </div>

      </div>
    </div>
  );
}