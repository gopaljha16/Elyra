# elyra-be

Node.js + TypeScript + Express backend for Elyra.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the env template:

```bash
cp .env.example .env
```

3. Fill in at least:

- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `FRONTEND_URL`
- `DATABASE_URL`
- `OPENAI_API_KEY`

4. Start the dev server:

```bash
npm run dev
```

The API runs on `http://localhost:5000`.

## Auth flow

- Frontend signs users in with Clerk.
- Frontend sends the Clerk session token to the backend as `Authorization: Bearer <token>`.
- Express uses `clerkMiddleware()` plus `getAuth()` to verify the token.
- Protected routes return `401` if the token is missing or invalid.

## Routes

- `GET /health`
- `GET /api/auth/status`
- `GET /api/auth/me`
- `POST /api/date-plans`
