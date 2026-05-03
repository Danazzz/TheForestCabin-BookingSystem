# Forest Cabin Booking Backend

Node.js, Express, MongoDB, and Mongoose backend for:

`Booking -> Payment -> Admin Approval -> Calendar Sync -> Invoice`

## Setup

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Default base URL:

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
CORS_ORIGIN=http://localhost:5173
UPLOAD_BASE_URL=http://localhost:5000
MAX_UPLOAD_SIZE_MB=5
```

## Booking Requests

Create a booking:

```http
POST /api/bookings
Content-Type: application/json
```

```json
{
  "guestName": "Dana Wardhiana",
  "guestEmail": "dana@example.com",
  "guestPhone": "+6281234567890",
  "propertyId": "forest-cabin-main",
  "roomId": "cabin-01",
  "roomType": "Forest Cabin Deluxe",
  "checkIn": "2026-06-12",
  "checkOut": "2026-06-14",
  "numberOfGuests": 2,
  "totalAmount": 1800000,
  "source": "direct"
}
```

List bookings:

```http
GET /api/bookings
GET /api/bookings?bookingStatus=waiting_admin_approval
GET /api/bookings?propertyId=forest-cabin-main&roomId=cabin-01
```

Get booking detail:

```http
GET /api/bookings/:id
```

Cancel booking:

```http
PATCH /api/bookings/:id/cancel
```

## Payment Requests

Create a virtual account payment:

```http
POST /api/payments/:bookingId/create
Content-Type: application/json
```

```json
{
  "paymentMethod": "va"
}
```

Create a QRIS payment:

```json
{
  "paymentMethod": "qris"
}
```

Create a manual transfer payment:

```json
{
  "paymentMethod": "manual_transfer"
}
```

Upload manual transfer proof:

```http
POST /api/payments/:paymentId/upload-proof
Content-Type: multipart/form-data
```

Form field:

```txt
proofImage: payment-proof.jpg
```

Accepted files: `jpg`, `jpeg`, `png`, `webp`.

Get payments by booking:

```http
GET /api/payments/booking/:bookingId
```

Placeholder gateway webhook:

```http
POST /api/payments/webhook
Content-Type: application/json
```

```json
{
  "transactionReference": "VA-1710000000000-ABC123",
  "paymentStatus": "paid"
}
```

## Admin Requests

Authentication is intentionally a placeholder for now. Admin routes accept optional headers:

```txt
x-admin-id: admin-user-id
x-user-role: admin
```

Get bookings waiting for approval:

```http
GET /api/admin/bookings/waiting-approval
```

Admin booking detail:

```http
GET /api/admin/bookings/:id
```

Approve payment:

```http
PATCH /api/admin/payments/:paymentId/approve
Content-Type: application/json
```

```json
{
  "adminNote": "Payment proof verified."
}
```

Reject payment:

```http
PATCH /api/admin/payments/:paymentId/reject
Content-Type: application/json
```

```json
{
  "adminNote": "Transfer receipt is unreadable. Please upload a clearer image."
}
```

Approval behavior:

- Manual transfer payments must have proof uploaded.
- Calendar availability is checked before approval.
- Approval creates a confirmed calendar event.
- Approval generates a paid invoice.
- If dates overlap an existing confirmed event for the same `roomId`, approval returns `409`.

## Invoice Requests

Get invoice by invoice ID:

```http
GET /api/invoices/:id
```

Get invoice by booking ID:

```http
GET /api/invoices/booking/:bookingId
```

PDF export is not implemented yet, but the invoice service has a placeholder for adding it later.

## Calendar Requests

Get events by property:

```http
GET /api/calendar/property/:propertyId
GET /api/calendar/property/:propertyId?startDate=2026-06-01&endDate=2026-06-30
```

Get events by room:

```http
GET /api/calendar/room/:roomId
GET /api/calendar/room/:roomId?startDate=2026-06-01&endDate=2026-06-30
```

Check room availability:

```http
POST /api/calendar/check-availability
Content-Type: application/json
```

```json
{
  "roomId": "cabin-01",
  "checkIn": "2026-06-12",
  "checkOut": "2026-06-14"
}
```

Overlap rule:

```js
existing.startDate < new.checkOut && existing.endDate > new.checkIn
```

## Response Format

Successful responses:

```json
{
  "success": true,
  "message": "Payment approved successfully",
  "data": {}
}
```

Error responses:

```json
{
  "success": false,
  "message": "Room is not available for the selected dates",
  "details": []
}
```
