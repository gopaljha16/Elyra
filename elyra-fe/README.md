# Elyra web app

The Next.js app takes signed-in users through profile setup, photo upload and selfie verification, then opens the dashboard. Draft fields and the current step are saved per Clerk account in browser storage. Uploaded photos and verification status are recovered from the API.

## Local setup

1. Start the [Elyra API](../elyra-be/README.md).
2. Run `bun install --frozen-lockfile` in `elyra-fe`.
3. Copy `.env.example` to `.env` and supply the matching Clerk configuration and the public Supabase URL and publishable or legacy anon key. Set `NEXT_PUBLIC_API_URL` to the API origin. Build from a checkout containing both apps so the frontend can use the shared onboarding choices.
4. Run `bun run dev` and open `http://localhost:3000`. Camera access requires HTTPS or localhost.

The browser loads the bundled Tiny Face Detector model and requests camera access when verification is available. Uploads, private photo previews, and verification requests use the authenticated Elyra API. The selfie preview stays on the device until the user submits it.

Profile photos are resized to at most 1024 pixels on the longest side and encoded as WebP in the browser when this reduces the file size. The server validates and processes the image again before private storage.

The dating dashboard requires a separate live camera check before opening nearby matching. It uses Amazon Rekognition Face Liveness through the Amplify React component. The backend creates the session and supplies short-lived streaming credentials to the signed-in account. Camera access requires HTTPS or localhost.

Run `bun run lint` and `bun run build` to check the frontend.
