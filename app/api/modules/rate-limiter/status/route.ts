import { NextResponse } from "next/server";
import { rateLimiter } from "@/lib/rateLimiterInstance";

export async function GET() {
  return NextResponse.json({
    metrics: rateLimiter.getMetrics(),
    history: rateLimiter.getHistory(),
  });
}
