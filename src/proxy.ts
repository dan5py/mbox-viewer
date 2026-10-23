import { NextResponse } from "next/server";

function getOrigin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function buildContentSecurityPolicy(): string {
  // Umami loads its script from, and sends events to, its own origin
  const umamiOrigin = getOrigin(process.env.UMAMI_SCRIPT_URL);
  const extra = umamiOrigin ? ` ${umamiOrigin}` : "";

  // Inline scripts are still allowed: Next.js and next-themes inject them
  // without a nonce. Email HTML can't run scripts anyway (sandboxed iframe).
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${extra}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${extra}`,
    "worker-src 'self' blob:",
    // PDF attachments are previewed from blob: URLs
    "frame-src 'self' blob:",
    "object-src 'self' blob:",
    "manifest-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function proxy() {
  const response = NextResponse.next();

  // The dev server needs eval and websockets for hot reload
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Content-Security-Policy",
      buildContentSecurityPolicy()
    );
  }

  return response;
}

export const config = {
  matcher: [
    // Only pages need a CSP: skip API routes and static files
    "/((?!api|_next/static|_next/image|icons|sw.js|favicon.ico).*)",
  ],
};
