import { NextResponse } from "next/server";
import { rateLimiter } from "@/lib/rateLimiterInstance";

export async function POST() {
  rateLimiter.reset();
  return NextResponse.json({ ok: true });
}
