import { useState } from "react";

export default function BookingSection({ highlight }) {
  const [form, setForm] = useState({
    checkIn: "",
    checkOut: "",
    guests: 2,
    children: 0,
    rooms: 1,
    roomSelection: {
      Standard: 0,
      Deluxe: 0,
      Premium: 0,
    },
    promo: "",
  });

  // ROOM CAPACITY
  const roomCapacity = {
    Standard: 2,
    Deluxe: 2,
    Premium: 3,
  };

  // HANDLE INPUT
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  // HANDLE ROOM CHANGE
  const handleRoomChange = (type, delta) => {
    setForm((prev) => ({
      ...prev,
      roomSelection: {
        ...prev.roomSelection,
        [type]: Math.max(0, prev.roomSelection[type] + delta),
      },
    }));
  };

  // TOTAL ROOM SELECTED
  const totalSelected =
    form.roomSelection.Standard +
    form.roomSelection.Deluxe +
    form.roomSelection.Premium;

  // TOTAL GUESTS
  const totalGuests =
    Number(form.guests) + Number(form.children);

  // TOTAL CAPACITY
  const totalCapacity =
    form.roomSelection.Standard * roomCapacity.Standard +
    form.roomSelection.Deluxe * roomCapacity.Deluxe +
    form.roomSelection.Premium * roomCapacity.Premium;

  // CHECK IF CAN ADD ROOM
  const canAddRoom = (type) => {
    const nextSelection = {
      ...form.roomSelection,
      [type]: form.roomSelection[type] + 1,
    };

    const nextCapacity =
      nextSelection.Standard * roomCapacity.Standard +
      nextSelection.Deluxe * roomCapacity.Deluxe +
      nextSelection.Premium * roomCapacity.Premium;

    return nextCapacity <= totalGuests + 2; // toleransi sedikit biar fleksibel
  };

  // SUBMIT
  const handleSubmit = () => {
    if (!form.checkIn || !form.checkOut) {
      alert("Please select dates");
      return;
    }

    if (totalSelected === 0) {
      alert("Please select at least 1 room");
      return;
    }

    if (totalSelected !== Number(form.rooms)) {
      alert("Total selected rooms must match number of rooms");
      return;
    }

    if (totalGuests > totalCapacity) {
      alert("Guests exceed room capacity");
      return;
    }

    console.log("BOOKING VALID:", form);
  };

  return (
    <section id="booking" className="py-12 px-4 bg-white text-center">
      <h2 className="text-2xl font-bold text-forest mb-6">
        Book Your Stay
      </h2>

      <div
        className={`max-w-md mx-auto bg-cream p-6 rounded-xl shadow-md 
        transition-all duration-500 
        ${
          highlight
            ? "scale-105 shadow-2xl ring-2 ring-green-400"
            : ""
        }`}
      >

        {/* DATE */}
        <input
          type="date"
          name="checkIn"
          value={form.checkIn}
          onChange={handleChange}
          className="w-full border p-2 mb-3 rounded"
        />

        <input
          type="date"
          name="checkOut"
          value={form.checkOut}
          onChange={handleChange}
          className="w-full border p-2 mb-3 rounded"
        />

        {/* GUESTS */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <input
            type="number"
            name="guests"
            min="1"
            value={form.guests}
            onChange={handleChange}
            className="border p-2 rounded"
            placeholder="Adults"
          />

          <input
            type="number"
            name="children"
            min="0"
            value={form.children}
            onChange={handleChange}
            className="border p-2 rounded"
            placeholder="Kids"
          />

          <input
            type="number"
            name="rooms"
            min="1"
            value={form.rooms}
            onChange={handleChange}
            className="border p-2 rounded"
            placeholder="Rooms"
          />
        </div>

        {/* ROOM SELECTION */}
        <div className="text-left mb-4">
          <p className="text-sm font-semibold text-forest mb-2">
            Select Rooms
          </p>

          {["Standard", "Deluxe", "Premium"].map((type) => (
            <div
              key={type}
              className="flex justify-between items-center bg-white p-3 rounded border mb-2"
            >
              <span className="text-sm">{type} Cabin</span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRoomChange(type, -1)}
                  className="px-2 bg-gray-200 rounded hover:bg-gray-300 transition"
                >
                  -
                </button>

                <span className="w-6 text-center font-semibold">
                  {form.roomSelection[type]}
                </span>

                <button
                  onClick={() => handleRoomChange(type, 1)}
                  disabled={!canAddRoom(type)}
                  className={`px-2 rounded text-white transition ${
                    canAddRoom(type)
                      ? "bg-green-700 hover:bg-green-800"
                      : "bg-gray-300 cursor-not-allowed"
                  }`}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* INFO */}
        <div className="text-xs text-gray-500 mb-4 text-left">
          <p>Total Guests: {totalGuests}</p>
          <p>Total Capacity: {totalCapacity}</p>
          <p>Total Rooms Selected: {totalSelected}</p>
        </div>

        {/* PROMO */}
        <select
          name="promo"
          value={form.promo}
          onChange={handleChange}
          className="w-full border p-2 mb-4 rounded"
        >
          <option value="">No Promo</option>
          <option value="Honeymoon">Honeymoon Package</option>
          <option value="Family">Family Package</option>
          <option value="LongStay">
            Stay 3 Nights Discount
          </option>
        </select>

        {/* BUTTON */}
        <button
          onClick={handleSubmit}
          className="w-full bg-forest text-white py-2 rounded 
          hover:bg-green-800 transition"
        >
          Check Availability
        </button>

      </div>
    </section>
  );
}