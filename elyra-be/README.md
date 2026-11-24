# Elyra API

The Express API uses Clerk sessions, PostgreSQL through Prisma, private Supabase Storage, and Gemini for selfie and profile photo comparison.

## Local setup

1. Run `bun install --frozen-lockfile` in `elyra-be`.
2. Copy `.env.example` to `.env` and fill in the Clerk keys, `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and `GEMINI_API_KEY`. Set `FRONTEND_URL` to the frontend origin. Use a Supabase secret key or legacy service-role key for `SUPABASE_SERVICE_KEY`. Keep service credentials on the backend.
3. Run [onboarding-storage.sql](supabase/onboarding-storage.sql) in the Supabase SQL editor for your project. Update the bucket name in the SQL and `SUPABASE_BUCKET` together if you use a different bucket.
4. Run `bun run prisma:generate` and `bun x prisma migrate deploy`. A fresh database needs the pgvector extension. If the database already has the original Elyra schema and has never tracked Prisma migrations, verify that it matches the baseline, then register that baseline with `bun x prisma migrate resolve --applied 20261124000000_baseline` before deploying the verification migration.
5. Run `bun run dev`. For production, run `bun run build` then `bun run start`.

Set `TRUSTED_PROXIES` to a comma-separated list of IPs or CIDRs for any reverse proxies you operate. With no proxy configuration, the API uses the direct connection IP for the hourly limit. Set `VERIFICATION_ADMIN_IDS` to the allowed Clerk user IDs to enable usage access for those accounts.

## Onboarding endpoints

All onboarding endpoints are under `/api/onboarding` and use a Clerk session bearer token.

| Method and path | Purpose |
| --- | --- |
| `GET /` | Read onboarding status, profile fields and private photo references |
| `PUT /profile` | Save validated profile details before adding photos |
| `POST /photos/upload-url` | Issue a one-hour, account-bound upload link |
| `PUT /photos/:id` | Validate image bytes, write to private Storage, and persist the photo |
| `GET /photos/:id` | Fetch a photo belonging to the authenticated account |
| `DELETE /photos/:id` | Remove a photo and choose a new primary if needed |
| `PATCH /photos/:id/primary` | Set the primary profile photo |
| `GET /verification` | Read verification progress, remaining attempts and retry timing |
| `POST /verification` | Submit a JPEG or PNG selfie under 1 MiB |
| `GET /verification/usage` | Read Gemini requests and image bytes by day for the current UTC calendar month, restricted to administrators |

Upload links are signed by Elyra and require the issuing Clerk account. The API writes images into that accountâ€™s folder in a private bucket. Every accepted verification attempt is recorded before the Gemini call. Successful verification finalizes the profile and audit result together in a database transaction.

The Gemini check considers visible spoof cues and compares the two faces. One still selfie cannot establish micro-movement or provide reliable liveness verification. `GEMINI_MODEL` selects the model available to your project.

## Dating pilot

Add `GOOGLE_PLACES_API_KEY` to the backend environment to enable real venue suggestions. The API queries Google Nearby Search only when a matched pair opens the venue picker or submits a proposal. Enable Places API (New) for the key. Both users set an approximate area through browser location access. The first release matches people in the same city whose age, gender and distance preferences fit both ways. Each user chooses up to five date activities on the dashboard. After both accept, the pair can propose a venue and time. The other participant must accept the current proposal version. Feedback is private to the submitting account. The map provider returns venue names and addresses on demand.

## Existing API routes

- `GET /health` reports API health.
- `GET /api/auth/status` reports whether the request has a Clerk session.
- `GET /api/auth/me` returns the authenticated Clerk user.
- `POST /api/date-plans` is the authenticated date-plan placeholder.
