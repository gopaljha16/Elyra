import "dotenv/config";

import { clerkMiddleware, clerkClient, getAuth } from "@clerk/express";
import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import helmet from "helmet";
import morgan from "morgan";
import { z } from "zod";
import { ApiError, createDatabase } from "./onboarding/profile.js";
import { onboardingRoutes } from "./onboarding/routes.js";
import { createStorage } from "./onboarding/storage.js";
import { verificationRoutes } from "./onboarding/verification.js";
import { datingRoutes } from "./dating/routes.js";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(5000),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  SUPABASE_BUCKET: z.string().min(1).default("elyra-onboarding"),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().regex(/^[a-z0-9.-]+$/).default("gemini-3.5-flash-lite"),
  VERIFICATION_ADMIN_IDS: z.string().default(""),
  TRUSTED_PROXIES: z.string().default(""),
  OPENAI_API_KEY: z.string().min(1).optional(),
});

let env: z.infer<typeof envSchema>;
try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("Invalid environment variables:");
    console.error(JSON.stringify(error.flatten().fieldErrors, null, 2));
    process.exit(1);
  }
  throw error;
}
const app = express();
const trustedProxies = env.TRUSTED_PROXIES.split(",").map((value) => value.trim()).filter(Boolean);
if (trustedProxies.length) app.set("trust proxy", trustedProxies);

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }),
);
app.use(helmet());
app.use(morgan(":method :safe-path :status :response-time ms"));
morgan.token("safe-path", (req: Request) => req.originalUrl.split("?")[0]);
app.use(express.json({ limit: "1mb" }));
app.use(clerkMiddleware({ authorizedParties: [env.FRONTEND_URL] }));
const db = createDatabase(env.DATABASE_URL);
const storage = createStorage(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, env.SUPABASE_BUCKET);
app.use("/api/onboarding", verificationRoutes(db, storage, {
  geminiKey: env.GEMINI_API_KEY,
  geminiModel: env.GEMINI_MODEL,
  ipHashKey: env.SUPABASE_SERVICE_KEY,
  adminIds: env.VERIFICATION_ADMIN_IDS.split(",").map((id) => id.trim()).filter(Boolean),
}));
app.use("/api/onboarding", onboardingRoutes(db, storage));
app.use("/api/dating", datingRoutes(db));

type AuthedRequest = Request & {
  auth?: ReturnType<typeof getAuth>;
};

const requireApiAuth: RequestHandler = (req, res, next) => {
  const auth = getAuth(req);

  if (!auth.isAuthenticated || !auth.userId) {
    return res.status(401).json({
      error: "Unauthorized",
      message:
        "Missing or invalid Clerk session token. Send the Clerk session token as a Bearer token.",
    });
  }

  (req as AuthedRequest).auth = auth;
  next();
};

const validateBody =
  <T extends z.ZodTypeAny>(schema: T): RequestHandler =>
  (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: "Invalid request body",
        issues: result.error.flatten(),
      });
    }

    req.body = result.data;
    next();
  };

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "elyra-be",
    authProvider: "clerk",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/auth/status", (req, res) => {
  const auth = getAuth(req);

  res.json({
    isAuthenticated: auth.isAuthenticated,
    userId: auth.userId ?? null,
    sessionId: auth.sessionId ?? null,
  });
});

app.get("/api/auth/me", requireApiAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await clerkClient.users.getUser(userId);

    return res.json({
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        primaryEmailAddress:
          user.emailAddresses.find(
            (email: (typeof user.emailAddresses)[number]) =>
              email.id === user.primaryEmailAddressId,
          )?.emailAddress ?? null,
        imageUrl: user.imageUrl,
      },
    });
  } catch (error) {
    next(error);
  }
});

const datePlanSchema = z.object({
  prompt: z.string().min(1).max(2000),
});

app.post(
  "/api/date-plans",
  requireApiAuth,
  validateBody(datePlanSchema),
  async (req: AuthedRequest, res) => {
    res.status(501).json({
      message:
        "Authenticated route is working. Add your OpenAI + Prisma date plan logic here next.",
      userId: req.auth?.userId ?? null,
      payload: req.body,
    });
  },
);

app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    path: req.path,
  });
});

app.use(
  (
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    if (error instanceof ApiError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Check the submitted details.", issues: error.flatten() });
      return;
    }
    if (typeof error === "object" && error !== null && "type" in error) {
      if (error.type === "entity.too.large") {
        const message = _req.path.startsWith("/api/onboarding/photos/")
          ? "Each photo must be 5 MB or smaller." : "Image size exceeds maximum allowed";
        res.status(413).json({ error: message });
        return;
      }
      if (error.type === "entity.parse.failed") {
        res.status(400).json({ error: "Invalid JSON." });
        return;
      }
    }
    console.error("API request failed", error instanceof Error ? error.name : "Unknown error");
    res.status(503).json({ error: "Service is temporarily unavailable. Please try again later." });
  },
);

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});
