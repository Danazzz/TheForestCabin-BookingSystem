import TimeSlots from "./TimeSlots";

export default function BookingForm({ form, setForm, onSubmit }) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <input name="name" placeholder="Name" onChange={handleChange} required />
      <input name="email" placeholder="Email" onChange={handleChange} required />
      <input type="date" name="date" onChange={handleChange} required />

      <TimeSlots
        selected={form.time}
        setSelected={(t) => setForm((p) => ({ ...p, time: t }))}
      />

      <button className="bg-black text-white p-2">Book Now</button>
    </form>
  );
}