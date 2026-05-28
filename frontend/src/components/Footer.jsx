import { FaInstagram, FaTiktok } from "react-icons/fa";

export default function Footer() {
  return (
    <footer id="footer" className="bg-forest text-cream px-6 py-10">

      <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8 items-start">

        {/* BRAND */}
        <div>
          <img
            src="/logo/The Forest Cabin White.PNG"
            alt="Forest Cabin Logo"
            className="h-28 md:h-32 object-contain"
          />
        </div>

        {/* CONTACT */}
        <div>
          <h3 className="font-semibold mb-3">Contact</h3>
          <p className="text-sm">Bali, Indonesia</p>
          <p className="text-sm">+62 815-1167-1818</p>
          <p className="text-sm">theforestcabin.kintamani@gmail.com</p>
        </div>

        {/* SOCIAL */}
        <div>
          <h3 className="font-semibold mb-3">Follow Us</h3>

          <div className="flex gap-4 text-xl">

            <a
              href="https://www.instagram.com/theforestcabin.kintamani?igsh=eHo0YTdxd3FzaTY4"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition transform hover:scale-110"
            >
              <FaInstagram />
            </a>

            <a
              href="https://www.tiktok.com/@theforestcabin.kintamani?_r=1&_t=ZS-96jCa4vN96O"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition transform hover:scale-110"
            >
              <FaTiktok />
            </a>

          </div>
        </div>

      </div>

      {/* DIVIDER */}
      <div className="border-t border-cream/20 mt-8 pt-4 text-center text-sm text-cream/70">
        © {new Date().getFullYear()} Forest Cabin. All rights reserved.
      </div>

    </footer>
  );
}