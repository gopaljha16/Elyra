import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    // Ensure all requests are passed through the middleware except static assets
    '/((?!_next|static|favicon.ico).*)',
  ],
};
