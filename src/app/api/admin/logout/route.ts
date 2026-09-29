import { NextResponse } from "next/server";
import { sessionCookieName } from "@/lib/wp-admin";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const expired = `${sessionCookieName()}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
  response.headers.append("Set-Cookie", `${expired}; Path=/`);
  response.headers.append("Set-Cookie", `${expired}; Path=/admin`);
  return response;
}
