import { NextResponse } from "next/server";

/**
 * Auth gate (Clerk) is enabled once publishable/secret keys are in .env.
 * Scaffold default: pass-through so local collab works without Clerk.
 * Follow-on: replace with clerkMiddleware() + route protection.
 */
export default function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
