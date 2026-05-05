# The Forest Cabin Shared Backend

Single Express/MongoDB API for both frontends:

- User booking frontend -> shared backend -> MongoDB
- Admin frontend -> shared backend -> MongoDB

## Local Setup

```bash
cd /Users/danawardhiana/Projects/forestCabin-booking/backend
npm install
cp .env.example .env
npm run dev
```

Base URL:

```txt
http://localhost:5000
```

Health check:

```http
GET /api/health
```

## Environment

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/forest-cabin-booking
CORS_ORIGIN=http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174
UPLOAD_BASE_URL=http://localhost:5000
MAX_UPLOAD_SIZE_MB=5
```

Payment proof upload currently uses Multer local storage at `/uploads/payment-proofs`. Set `UPLOAD_BASE_URL` to the deployed backend URL in production, or replace the upload middleware with Cloudinary storage before deploying to non-persistent hosts.

## Rooms

Rooms are not seeded automatically. Add real room inventory from the admin frontend Rooms page or through the `/api/rooms` API before testing availability or booking creation.

## User API

Check availability:

```http
GET /api/rooms/availability?roomType=deluxe&checkIn=2026-05-10&checkOut=2026-05-12
```

Create booking:

```http
POST /api/bookings
Content-Type: application/json
```

```json
{
  "guestName": "John Doe",
  "guestEmail": "john@example.com",
  "guestPhone": "+628123456789",
  "roomType": "deluxe",
  "checkIn": "2026-05-10",
  "checkOut": "2026-05-12",
  "numberOfGuests": 2,
  "totalAmount": 1900000,
  "source": "direct"
}
```

Check booking status:

```http
GET /api/bookings/code/TFC-20260503-ABCDE
```

Create payment:

```http
POST /api/payments/:bookingId/create
Content-Type: application/json
```

```json
{
  "paymentMethod": "manual_transfer"
}
```

Other placeholder methods:

```json
{ "paymentMethod": "qris" }
```

```json
{ "paymentMethod": "virtual_account" }
```

Upload manual transfer proof:

```http
POST /api/payments/:paymentId/upload-proof
Content-Type: multipart/form-data
```

Field:

```txt
proofImage
```

Get invoice after approval:

```http
GET /api/invoices/booking/:bookingId
```

## Admin API

Auth is a permissive placeholder for now.

```http
GET /api/admin/bookings
GET /api/admin/bookings/waiting-approval
GET /api/admin/bookings/:id
```

Approve payment and booking:

```http
PATCH /api/admin/payments/:paymentId/approve
Content-Type: application/json
```

```json
{
  "adminNote": "Payment proof verified."
}
```

Reject payment or booking:

```http
PATCH /api/admin/payments/:paymentId/reject
Content-Type: application/json
```

```json
{
  "rejectionReason": "no_room_available",
  "adminNote": "Selected room is no longer available."
}
```

Calendar:

```http
GET /api/admin/calendar
GET /api/admin/calendar/grid?startDate=2026-05-01&endDate=2026-05-31&roomType=all
```

Admin availability check:

```http
POST /api/admin/availability/check
Content-Type: application/json
```

```json
{
  "roomId": "ROOM_OBJECT_ID",
  "checkIn": "2026-05-10",
  "checkOut": "2026-05-12"
}
```

## Availability Rule

Only `success` bookings block rooms:

```txt
existing.checkIn < new.checkOut AND existing.checkOut > new.checkIn
```

`waiting_admin_approval` bookings show in the admin calendar as pending, but do not permanently block availability. `rejected` and `cancelled` do not block availability.

Approval creates the calendar event and invoice. If the room has become unavailable, approval returns:

```json
{
  "success": false,
  "message": "Cannot approve booking because the room is no longer available."
}
```
