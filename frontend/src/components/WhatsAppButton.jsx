import { FaWhatsapp } from "react-icons/fa";

export default function WhatsAppButton() {
  const phoneNumber = "6281511671818"; // tanpa +
  const message = "Halo, saya sudah melihat website Forest Cabin dan ingin mendapatkan informasi lebih lanjut terkait penginapan";

  const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-5 right-5 z-50 bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-lg transition transform hover:scale-110"
    >
      <FaWhatsapp size={24} />
    </a>
  );
}