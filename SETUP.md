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
2. `GET http://localhost:5000/api/rooms/availability?roomType=family_suite&checkIn=2026-05-10&checkOut=2026-05-12`
3. `GET http://localhost:5000/api/rooms/availability-calendar?roomType=family_suite&startDate=2026-05-01&endDate=2026-05-31`
4. `POST http://localhost:5000/api/bookings`
5. `POST http://localhost:5000/api/payments/:bookingId/create`
6. `POST http://localhost:5000/api/payments/:paymentId/upload-proof`
7. `GET http://localhost:5000/api/admin/bookings/waiting-approval`
8. `PATCH http://localhost:5000/api/admin/payments/:paymentId/approve`
9. `GET http://localhost:5000/api/bookings/code/:bookingCode`
10. `GET http://localhost:5000/api/invoices/booking/:bookingId`
11. `GET http://localhost:5000/api/admin/calendar/grid?startDate=2026-05-01&endDate=2026-05-31&roomType=all`
12. `GET http://localhost:5000/api/content/promo`
13. `GET http://localhost:5000/api/admin/content?includeInactive=true`

Manual transfer proof upload must use `multipart/form-data` with field name `proofImage`.
Website content image upload uses `multipart/form-data` with field name `image`.
