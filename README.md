# The Forest Cabin Booking System

Shared backend API and guest booking frontend for The Forest Cabin Kintamani.

## Structure

```text
backend/   Shared Express + MongoDB API used by guest and admin frontends
frontend/  Public guest booking website
```

The admin frontend lives in the sibling project:

```text
integration-booking-forestCabin/frontend
```

Both frontends must point to the same backend through `VITE_API_URL`.

## Local Development

Backend:

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Guest frontend:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

The running URLs are printed by each dev server in the terminal.

## Production Notes

- Use MongoDB Atlas for `MONGODB_URI`.
- Use Cloudinary for image uploads with `UPLOAD_PROVIDER=cloudinary`.
- Set `CORS_ORIGIN` to the guest and admin frontend URLs.
- Set `USER_FRONTEND_URL` and `ADMIN_FRONTEND_URL` to the deployed frontend URLs.
- Seed the first admin user from `backend` with `npm run seed:admin`.

## Main Flows

- Guests submit booking requests from the public website.
- Admin approves availability from the admin panel.
- Guests continue to manual payment after availability approval.
- Admin approves payment proof.
- Successful bookings generate invoices and calendar events.
- Promos, room descriptions/photos, and gallery images are managed by admin and shown on the guest website.

## Folder Docs

- Backend details: [backend/README.md](backend/README.md)
- Guest frontend details: [frontend/README.md](frontend/README.md)
