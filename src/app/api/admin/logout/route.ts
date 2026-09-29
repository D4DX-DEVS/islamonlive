import { NextResponse } from "next/server";
import { clearAdminSession } from "@/lib/wp-admin";

export async function POST() {
  await clearAdminSession();
  return NextResponse.json({ ok: true });
}
