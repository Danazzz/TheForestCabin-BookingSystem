import { useState } from "react";
import { FiMenu, FiX } from "react-icons/fi";

const navItems = [
  { href: "#promo", label: "Promotions" },
  { href: "#accommodations", label: "Accommodations" },
  { href: "#availability-calendar", label: "Calendar" },
  { href: "#location", label: "Location" },
  { href: "#gallery", label: "Gallery" },
  { href: "#footer", label: "Contact Us" },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="w-full bg-forest text-white shadow-md fixed top-0 z-50">
      <div className="max-w-6xl mx-auto flex justify-between items-center px-6 py-4 relative">

        <a href="#home" onClick={closeMenu} className="flex items-center">
          <img
            src="/logo/The Forest Cabin White.PNG"
            alt="Forest Cabin Logo"
            className="h-10 object-contain hover:scale-105 transition duration-300"
          />
        </a>

        <nav className="hidden gap-6 text-sm font-medium md:flex">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} className="hover:text-cream">
              {item.label}
            </a>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setMenuOpen((current) => !current)}
          className="flex h-10 w-10 items-center justify-center rounded border border-white/30 text-white transition hover:bg-white/10 md:hidden"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <FiX aria-hidden="true" /> : <FiMenu aria-hidden="true" />}
        </button>

        {menuOpen ? (
          <nav className="absolute left-4 right-4 top-full mt-2 overflow-hidden rounded bg-white text-forest shadow-xl md:hidden">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={closeMenu}
                className="block border-b border-green-100 px-4 py-3 text-sm font-semibold last:border-b-0 hover:bg-cream"
              >
                {item.label}
              </a>
            ))}
          </nav>
        ) : null}

      </div>
    </div>
  );
}
