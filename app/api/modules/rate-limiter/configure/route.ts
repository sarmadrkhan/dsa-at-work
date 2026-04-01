import { NextRequest, NextResponse } from "next/server";
import { rateLimiter } from "@/lib/rateLimiterInstance";
import { RateLimiterStrategy } from "@/modules/05-sliding-window/core/rateLimiter";

export async function POST(req: NextRequest) {
  const { windowMs, maxRequests, strategy } = await req.json();

  rateLimiter.configure({
    windowMs,
    maxRequests,
    strategy: strategy as RateLimiterStrategy,
  });

  return NextResponse.json({ ok: true });
}
