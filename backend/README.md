# The Forest Cabin Shared Backend

Single Express/MongoDB API for both frontends:

- User booking frontend -> shared backend -> MongoDB
- Admin frontend -> shared backend -> MongoDB

## Local Setup

```bash
npm install
cp .env.example .env
npm run dev
```

The server prints its active port when it starts.

Health check:

```http
GET /api/health
```

## Environment

```env
PORT=5001
NODE_ENV=development
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/<database>?retryWrites=true&w=majority
CORS_ORIGIN=https://guest.example.com,https://admin.example.com
UPLOAD_BASE_URL=https://api.example.com
UPLOAD_PROVIDER=cloudinary
MAX_UPLOAD_SIZE_MB=5
CLOUDINARY_CLOUD_NAME=<cloudinary-cloud-name>
CLOUDINARY_API_KEY=<cloudinary-api-key>
CLOUDINARY_API_SECRET=<cloudinary-api-secret>
CLOUDINARY_FOLDER=theforestcabin
DATABASE_STORAGE_LIMIT_MB=512
DATABASE_STORAGE_WARNING_PERCENT=80
JWT_SECRET=<long-random-secret>
JWT_EXPIRES_IN=7d
ADMIN_SEED_EMAIL=<admin-email@example.com>
ADMIN_SEED_USERNAME=<admin-username>
ADMIN_SEED_PASSWORD=<strong-admin-password>
ADMIN_SEED_NAME=<admin-display-name>
USER_FRONTEND_URL=https://guest.example.com
ADMIN_FRONTEND_URL=https://admin.example.com
ADMIN_NOTIFICATION_EMAILS=<admin-email@example.com>
SMTP_DAILY_LIMIT=500
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<smtp-username>
SMTP_PASS=<smtp-password-or-app-password>
SMTP_FROM="The Forest Cabin <reservations@example.com>"
SMTP_REPLY_TO=<reply-to@example.com>
```

Uploads use local Multer disk storage by default for development. For production on
non-persistent platforms, set `UPLOAD_PROVIDER=cloudinary` and configure
`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.
Payment proofs, room images, promo images, gallery images, payment option
images, and invoice logos will then be uploaded to Cloudinary. `UPLOAD_BASE_URL`
is only needed for local upload URLs.

## Admin Auth

Admin APIs require a JWT bearer token. Create or update the first admin user from environment variables:

```bash
cd backend
npm run seed:admin
```

Then login from the admin frontend or call:

```http
POST /api/auth/admin/login
Content-Type: application/json
```

```json
{
  "identifier": "admin",
  "password": "your-admin-password"
}
```

Use the returned token for admin requests:

```http
Authorization: Bearer YOUR_TOKEN
```

Set a strong `JWT_SECRET` in production. `ADMIN_SEED_PASSWORD` should be stored only as an environment variable and should not be committed.

Invoice and booking emails use SMTP through Nodemailer. If SMTP is not configured, bookings can still be approved and invoices are still generated; the invoice email status becomes `not_configured`.

SMTP production example:

```env
SMTP_DAILY_LIMIT=500
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<smtp-username>
SMTP_PASS=<smtp-password-or-app-password>
SMTP_FROM="The Forest Cabin <reservations@example.com>"
SMTP_REPLY_TO=<reply-to@example.com>
```

Use an app password or provider-issued SMTP credential for `SMTP_PASS`, not a personal account password. `SMTP_DAILY_LIMIT` is used for admin dashboard warnings.

Set `ADMIN_NOTIFICATION_EMAILS` to one or more comma-separated admin email addresses to notify admins when a guest submits a new booking request. `ADMIN_FRONTEND_URL` is used to build the admin booking detail link in that email.

## Rooms

Rooms are not seeded automatically. Add real room inventory from the admin frontend Rooms page or through the `/api/rooms` API before testing availability or booking creation.

Create a room with any room type. Rooms support multiple photos through
`multipart/form-data`; use the field name `images` for one or more uploaded
files. `imageUrl` is still supported as an optional external or legacy cover URL.

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

For the guest frontend, `/api/rooms/types` groups all active rooms by `roomType`
and combines their photos in room-number/upload order. This lets admin upload
photos per physical room while guests see one room-type gallery.

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

Guest booking requests now start as `waiting_availability_approval`. The guest
does not create a payment yet. Admin must approve availability first; once
approved, the booking becomes `pending_payment` and the guest can create payment
instructions from the booking status page. A payment deadline is set from
`PAYMENT_DEADLINE_HOURS` and defaults to 24 hours.

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

Payment creation is only allowed when the booking status is `pending_payment`.

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

Invoice settings are managed from the admin API and are used when new invoices are generated and invoice emails are sent. SMTP credentials remain in `.env`.

## Admin API

Admin routes require `Authorization: Bearer <token>`.

```http
POST /api/auth/admin/login
GET /api/auth/admin/me
GET /api/admin/dashboard/summary
GET /api/admin/exports/bookings-occupancy.csv
GET /api/admin/exports/invoices-income.csv
GET /api/admin/bookings
POST /api/admin/bookings/manual
GET /api/admin/bookings/waiting-approval
GET /api/admin/bookings/:id
PATCH /api/admin/bookings/:id/guest-email
PATCH /api/admin/bookings/:id/availability/approve
PATCH /api/admin/bookings/:id/availability/reject
PATCH /api/admin/bookings/:id/cancel
POST /api/admin/bookings/:id/payment-reminder
POST /api/admin/bookings/:id/email/resend
```

Dashboard summary:

```http
GET /api/admin/dashboard/summary?startDate=2026-05-01&endDate=2026-05-31
```

The `endDate` filter is inclusive. Occupancy uses proportional room-night
overlap, so a confirmed booking that crosses month boundaries only contributes
the nights inside the selected dashboard range.

Database storage warning is included in the dashboard response. Set
`DATABASE_STORAGE_LIMIT_MB` to your MongoDB plan limit and
`DATABASE_STORAGE_WARNING_PERCENT` to the warning threshold.

Admin CSV exports:

```http
GET /api/admin/exports/bookings-occupancy.csv?startDate=2026-05-01&endDate=2026-05-31
GET /api/admin/exports/invoices-income.csv?startDate=2026-05-01&endDate=2026-05-31
```

`bookings-occupancy.csv` exports bookings that overlap the selected stay range,
plus occupancy and source-income summaries. `invoices-income.csv` exports
invoices issued inside the selected date range, plus paid income summaries.

Availability review:

```http
PATCH /api/admin/bookings/:id/availability/approve
Content-Type: application/json
```

```json
{
  "roomId": "OPTIONAL_ROOM_OBJECT_ID",
  "adminNote": "Room is available. Guest can continue payment."
}
```

If `roomId` is omitted, the backend assigns the first available active room for
the requested room type. Reject unavailable dates with:

```http
PATCH /api/admin/bookings/:id/availability/reject
Content-Type: application/json
```

```json
{
  "rejectionReason": "no_room_available",
  "adminNote": "Requested dates are not available."
}
```

Availability approval and rejection both attempt to email the guest when an email
provider is configured.

New guest booking requests attempt to notify the admin emails configured in
`ADMIN_NOTIFICATION_EMAILS`. This notification is non-blocking: the booking is
still created even if admin email is not configured or the send attempt fails.

Payment reminders can be sent for bookings with `pending_payment` status. The
email points guests back to the frontend status page through `USER_FRONTEND_URL`.

If a guest enters the wrong email, update it from admin booking detail:

```http
PATCH /api/admin/bookings/:id/guest-email
Content-Type: application/json
```

```json
{
  "guestEmail": "correct-email@example.com"
}
```

Booking email delivery is tracked on the booking record with
`emailDeliveryStatus`, `emailDeliveryType`, `emailDeliveryRecipient`,
`emailDeliveryError`, `emailLastAttemptedAt`, and `emailLastSentAt`. After
fixing an email address, resend the relevant booking email:

```http
POST /api/admin/bookings/:id/email/resend
```

Create a manual admin booking:

```http
POST /api/admin/bookings/manual
Content-Type: application/json
```

```json
{
  "guestName": "Walk-in Guest",
  "guestPhone": "+628123456789",
  "guestEmail": "guest@example.com",
  "roomId": "ROOM_OBJECT_ID",
  "checkIn": "2026-05-10",
  "checkOut": "2026-05-12",
  "numberOfGuests": 2,
  "numberOfChildren": 0,
  "source": "whatsapp",
  "sourceName": "WhatsApp",
  "bookingStatus": "success",
  "paymentStatus": "paid",
  "overrideTotal": false,
  "adminNote": "Booked directly through admin."
}
```

Manual booking sources are dynamic. Create source options through `/api/channels`, then send either the channel `key` as `source` or `channelId` when creating a manual booking. If no source is sent, the backend falls back to `manual_admin` for backwards compatibility. When created as `success` with `paid`, the backend checks availability, creates the calendar event, generates the invoice, and sends the invoice email if invoice settings and SMTP allow it.

Booking source channels:

```http
GET /api/channels
GET /api/channels?includeInactive=true
POST /api/channels
PATCH /api/channels/:id
DELETE /api/channels/:id
```

```json
{
  "name": "Traveloka",
  "type": "OTA",
  "isActive": true
}
```

Manual admin bookings are intentionally simpler than website bookings:

- `pending_payment` always means payment is `unpaid`
- `success` always means payment is `paid`
- `waiting_admin_approval` is reserved for website bookings where guests upload proof for admin review

Cancel an admin booking:

```http
PATCH /api/admin/bookings/:id/cancel
Content-Type: application/json
```

```json
{
  "cancellationReason": "guest_cancelled",
  "adminNote": "Guest requested cancellation by phone."
}
```

Cancelling a booking sets `bookingStatus` to `cancelled`, cancels its confirmed calendar event, cancels its invoice, and marks paid bookings as `refund_required`.

Payment option management:

```http
GET /api/admin/payment-options?includeInactive=true
POST /api/admin/payment-options
PATCH /api/admin/payment-options/:id
DELETE /api/admin/payment-options/:id
```

`POST` and `PATCH` support JSON with `imageUrl` or `multipart/form-data` with optional image field `image` for QRIS and other payment images. Bank transfer and virtual account options require `bankName`, `accountName`, and `accountNumber`. QRIS options require an image or `qrisCode`. Other payment options require a payment name in `merchantName`.

Invoice settings:

```http
GET /api/admin/invoice-settings
PATCH /api/admin/invoice-settings
```

`PATCH` supports JSON with `logoUrl` or `multipart/form-data` with optional logo image field `image`. Configurable fields include business info, invoice prefix, logo, invoice notes, email subject/message, primary/accent colors, `autoSendInvoiceEmail`, and `includeBookingStatusLink`.

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
