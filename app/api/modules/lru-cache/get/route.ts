import { NextRequest, NextResponse } from "next/server";
import { lruCache } from "@/lib/lruCacheInstance";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");

  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  const value = lruCache.get(key);
  const snapshot = lruCache.getSnapshot();

  return NextResponse.json({
    hit: value !== null,
    value,
    metrics: snapshot.metrics,
  });
}
