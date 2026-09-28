import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Site-wide HTTP Basic auth for the hosted demo (Vercel).
 *
 * Active only when SITE_PASSWORD is set, so local development, the scripts and the evidence runs are
 * unaffected. It covers every page AND every /api route: the API holds the agent wallet and the Kiln
 * key, so an open deployment would let anyone spend the test ETH and the Kiln credits.
 * Credentials: SITE_USER (default "perdiem") / SITE_PASSWORD, set as Vercel environment variables.
 */
const USER = process.env.SITE_USER || "perdiem";
const PASS = process.env.SITE_PASSWORD || "";

function sameText(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

export function proxy(request: NextRequest) {
  if (!PASS) return NextResponse.next();

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const colon = decoded.indexOf(":");
    if (colon >= 0) {
      const userOk = sameText(decoded.slice(0, colon), USER);
      const passOk = sameText(decoded.slice(colon + 1), PASS);
      if (userOk && passOk) return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required for this PerDiem demo.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="PerDiem demo", charset="UTF-8"', "Cache-Control": "no-store" },
  });
}

export const config = {
  // Everything except Next's static build assets (no secrets there); pages and /api are covered.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
