# The Forest Cabin Direct Booking Setup

## Run Locally

Backend:

```bash
cd /Users/danawardhiana/Projects/forestCabin-booking/backend
cp .env.example .env
npm install
npm run dev
```

User frontend:

```bash
cd /Users/danawardhiana/Projects/forestCabin-booking/frontend
cp .env.example .env
npm install
npm run dev
```

Admin frontend:

```bash
cd /Users/danawardhiana/Projects/integration-booking-forestCabin/frontend
cp .env.example .env
npm install
npm run dev -- --port 5174
```

Expected URLs:

- Backend: `http://localhost:5000`
- User frontend: `http://localhost:5173`
- Admin frontend: `http://localhost:5174`

## Thunder Client / Postman Flow

First add rooms from the admin frontend Rooms page, or create them through `POST http://localhost:5000/api/rooms`.

1. `GET http://localhost:5000/api/rooms`
2. `GET http://localhost:5000/api/rooms/availability?roomType=deluxe&checkIn=2026-05-10&checkOut=2026-05-12`
3. `POST http://localhost:5000/api/bookings`
4. `POST http://localhost:5000/api/payments/:bookingId/create`
5. `POST http://localhost:5000/api/payments/:paymentId/upload-proof`
6. `GET http://localhost:5000/api/admin/bookings/waiting-approval`
7. `PATCH http://localhost:5000/api/admin/payments/:paymentId/approve`
8. `GET http://localhost:5000/api/bookings/code/:bookingCode`
9. `GET http://localhost:5000/api/invoices/booking/:bookingId`
10. `GET http://localhost:5000/api/admin/calendar/grid?startDate=2026-05-01&endDate=2026-05-31&roomType=all`

Manual transfer proof upload must use `multipart/form-data` with field name `proofImage`.
