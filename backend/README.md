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
USER_FRONTEND_URL=http://localhost:5173
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM="The Forest Cabin <reservations@theforestcabin.local>"
```

Payment proof upload currently uses Multer local storage at `/uploads/payment-proofs`. Set `UPLOAD_BASE_URL` to the deployed backend URL in production, or replace the upload middleware with Cloudinary storage before deploying to non-persistent hosts.

Invoice email uses SMTP through Nodemailer. If SMTP is not configured, bookings can still be approved and invoices are still generated; the invoice email status becomes `not_configured`.

## Rooms

Rooms are not seeded automatically. Add real room inventory from the admin frontend Rooms page or through the `/api/rooms` API before testing availability or booking creation.

Create a room with any room type:

```http
POST /api/rooms
Content-Type: application/json
```

```json
{
  "roomNumber": "A101",
  "roomType": "family_suite",
  "name": "Family Suite",
  "capacity": 2,
  "childCapacity": 2,
  "basePrice": 1500000,
  "description": "Spacious family room with forest view.",
  "imageUrl": "https://example.com/family-suite.jpg",
  "details": ["1 king bed", "2 child beds", "Breakfast included"],
  "status": "active"
}
```

`roomType` is dynamic. The backend normalizes it to a lowercase slug, so `Family Suite` becomes `family_suite`.

Get active room types for frontend filters and booking forms:

```http
GET /api/rooms/types
```

Get a month-style room availability calendar for the user frontend:

```http
GET /api/rooms/availability-calendar?roomType=family_suite&startDate=2026-05-01&endDate=2026-05-31
```

## Promos and Gallery

The user frontend reads active promos and gallery images from the shared backend. Promo pricing is recalculated by the backend when `promoId` is sent with a booking.

Public promos:

```http
GET /api/promos/active
```

Admin promo management:

```http
GET /api/admin/promos?includeInactive=true
POST /api/admin/promos
PATCH /api/admin/promos/:id
DELETE /api/admin/promos/:id
```

Promo `adjustmentType` values are `none`, `percentage_discount`, `fixed_discount`, `bundle_price`, and `surcharge`. `POST` and `PATCH` support either JSON with `imageUrl`, or `multipart/form-data` with optional image field `image`.

Gallery:

```http
GET /api/gallery
GET /api/admin/gallery
POST /api/admin/gallery
DELETE /api/admin/gallery/:id
```

Gallery upload uses `multipart/form-data` with optional image field `image`, or JSON/FormData `imageUrl`.

## User API

Check availability:

```http
GET /api/rooms/availability?roomType=family_suite&checkIn=2026-05-10&checkOut=2026-05-12
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
  "roomType": "family_suite",
  "checkIn": "2026-05-10",
  "checkOut": "2026-05-12",
  "numberOfGuests": 2,
  "numberOfChildren": 1,
  "totalAmount": 1900000,
  "source": "direct"
}
```

Check booking status:

```http
GET /api/bookings/code/TFC-20260503-ABCDE
```

List active payment options shown to guests:

```http
GET /api/payments/options/active
```

Create payment from a configured payment option:

```http
POST /api/payments/:bookingId/create
Content-Type: application/json
```

```json
{
  "paymentMethod": "manual_transfer",
  "paymentOptionId": "PAYMENT_OPTION_OBJECT_ID"
}
```

Payment methods are `manual_transfer`, `virtual_account`, `qris`, and `other`. They are manual/Xendit-like display methods, so guests still upload proof and admins approve. Public payment options are ordered automatically as transfer, virtual account, QRIS, then other.

Upload payment proof:

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

Payment option management:

```http
GET /api/admin/payment-options?includeInactive=true
POST /api/admin/payment-options
PATCH /api/admin/payment-options/:id
DELETE /api/admin/payment-options/:id
```

`POST` and `PATCH` support JSON with `imageUrl` or `multipart/form-data` with optional image field `image` for QRIS and other payment images. Bank transfer and virtual account options require `bankName`, `accountName`, and `accountNumber`. QRIS options require an image or `qrisCode`. Other payment options require a payment name in `merchantName`.

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
