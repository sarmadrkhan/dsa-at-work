import { NextRequest, NextResponse } from "next/server";
import { rateLimiter } from "@/lib/rateLimiterInstance";

export async function POST(req: NextRequest) {
  const { clientId } = await req.json();

  if (!clientId) {
    return NextResponse.json(
      { error: "clientId is required" },
      { status: 400 },
    );
  }

  const result = rateLimiter.handleRequest(clientId);
  return NextResponse.json(result);
}
