import { NextResponse } from "next/server";

/** Serve the IndexNow key as plain text. */
export async function GET(): Promise<Response> {
  const key = process.env.INDEXNOW_KEY ?? "";

  if (!key) {
    return new NextResponse("Not configured", { status: 404 });
  }

  return new NextResponse(key, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}
