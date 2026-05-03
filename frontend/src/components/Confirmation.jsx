export default function Confirmation({ form }) {
  return (
    <div className="p-4 bg-green-100 border">
      <h2 className="font-bold">Booking Confirmed</h2>
      <p>{form.name}</p>
      <p>{form.date} at {form.time}</p>
    </div>
  );
}