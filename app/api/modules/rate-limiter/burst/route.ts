import { NextRequest, NextResponse } from "next/server";
import { rateLimiter } from "@/lib/rateLimiterInstance";

export async function POST(req: NextRequest) {
  const { clientId, count = 10 } = await req.json();

  if (!clientId) {
    return NextResponse.json(
      { error: "clientId is required" },
      { status: 400 },
    );
  }

  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(rateLimiter.handleRequest(clientId));
  }

  return NextResponse.json({ results });
}
