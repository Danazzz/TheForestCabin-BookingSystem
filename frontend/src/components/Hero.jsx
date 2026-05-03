export default function Hero({ onBookClick }) {
  return (
    <section
      id="home"
      className="min-h-[80vh] md:h-screen relative flex items-center justify-center text-center"
    >

      {/* Background */}
      <img
        src="/public/homepage/IMG_0728.jpg"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />

      {/* Content */}
      <div className="relative z-10 px-4 md:px-6">
        <img
        src="/logo/The Forest Cabin Text.png"
        alt="Forest Cabin Logo"
        className="
            mx-auto
            w-64 md:w-96
            opacity-90
            mix-blend-lighten
            drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)]
        "
        />

        <p className="
        mt-4
        text-black
        text-base md:text-xl
        font-medium
        tracking-wide
        opacity-80
        ">
        Breathe, rest, and reconnect with nature
        </p>

        <button
          onClick={onBookClick}
          className="mt-6 px-6 py-3 bg-green-700 text-white rounded-full 
          shadow-md transition-all duration-300 ease-in-out
          hover:bg-green-800 hover:shadow-xl hover:-translate-y-1
          active:scale-95"
        >
          Book Now
        </button>
      </div>
    </section>
  );
}