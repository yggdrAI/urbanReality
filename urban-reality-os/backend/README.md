# Urban Reality Backend (Auth + Profile + GPS)

This is a minimal Node.js + Express backend scaffold for authentication, user profiles and GPS location storage.

Quick start

1. Copy `.env.example` to `.env` and set `MONGO_URI` and `JWT_SECRET`.

2. Install deps:

```bash
cd backend
npm install
```

3. Run server (dev):

```bash
npm run dev
```

API endpoints

- POST `/api/auth/signup` { name, email, password } -> { token, user }
- POST `/api/auth/login` { email, password } -> { token, user }
- GET `/api/user/profile` (Authorization: Bearer <token>) -> user object
- POST `/api/user/location` (Authorization: Bearer <token>) { lat, lng } -> { message }

Notes

- This scaffold uses JWT + bcryptjs for auth. It is intentionally minimal; for production hardening add input validation, rate limiting, HTTPS, secure cookie sessions, CSRF protections, etc.
