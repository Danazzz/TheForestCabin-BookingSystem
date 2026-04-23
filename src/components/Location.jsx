export default function Location() {
  return (
    <section
      id="location"
      className="py-10 px-4 md:px-6 text-center bg-white"
    >
      <h2 className="text-xl md:text-2xl font-bold text-forest mb-3">
        Our Location
      </h2>

      <div className="rounded-xl overflow-hidden shadow-md">
        <iframe
          className="w-full h-64 md:h-72"
          src="https://www.google.com/maps?q=theforestcabinkintamani&output=embed"
          loading="lazy"
        />
      </div>
    </section>
  );
}