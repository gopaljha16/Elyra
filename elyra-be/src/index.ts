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

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(5000),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
});

let env: z.infer<typeof envSchema>;
try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("❌ Invalid environment variables:");
    console.error(JSON.stringify(error.flatten().fieldErrors, null, 2));
    process.exit(1);
  }
  throw error;
}
const app = express();

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }),
);
app.use(helmet());
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "1mb" }));
app.use(clerkMiddleware());

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
    console.error(error);

    const message =
      error instanceof Error ? error.message : "Internal server error";

    res.status(500).json({
      error: "Internal server error",
      message,
    });
  },
);

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});
