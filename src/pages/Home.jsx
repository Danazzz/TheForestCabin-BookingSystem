import { useState } from "react";

import Navbar from "../components/Navbar";
import Gallery from "../components/Gallery";
import Footer from "../components/Footer";
import WhatsAppButton from "../components/WhatsAppButton";
import AccommodationList from "../components/AccommodationList";
import Hero from "../components/Hero";
import BookingSection from "../components/BookingSection";
import Location from "../components/Location";
import PromoCarousel from "../components/PromoCarousel";

export default function Home() {

  const [highlight, setHighlight] = useState(false);

  const handleScrollToBooking = () => {
    const section = document.getElementById("booking");
    if (section) {
        section.scrollIntoView({ behavior: "smooth" });
    }

    setHighlight(true);
    setTimeout(() => setHighlight(false), 1000);
  };

  return (
    <div className="bg-cream">
      <Navbar />
      <Hero onBookClick={handleScrollToBooking} />
      <PromoCarousel /> 
      <AccommodationList />
      <BookingSection highlight={highlight} />
      <Location />
      <Gallery />
      <Footer />
      <WhatsAppButton />

    </div>
  );
}