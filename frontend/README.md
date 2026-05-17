# The Forest Cabin Guest Frontend

Public Vite React website for guests to view promos, accommodations, gallery, availability, booking status, payment instructions, and invoices.

## Local Setup

```bash
cp .env.example .env
npm install
npm run dev
```

The dev server prints the preview URL in the terminal.

## Environment

```env
VITE_API_URL=https://api.example.com
```

For each environment, set `VITE_API_URL` to the shared backend URL for that environment.

## Content Source

Guest content is not hardcoded:

- Promos come from `/api/promos/active`.
- Accommodations come from `/api/rooms/types`.
- Gallery images come from `/api/gallery`.
- Room type photos are combined from all active rooms in the same room type, ordered by upload order.

## Commands

```bash
npm run dev
npm run lint
npm run build
npm run preview
```
