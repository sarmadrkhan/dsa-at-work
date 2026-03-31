import { NextRequest, NextResponse } from "next/server";
import { lruCache } from "@/lib/lruCacheInstance";

export async function POST(req: NextRequest) {
  const { maxSize, ttlMs } = await req.json();

  lruCache.configure({ maxSize, ttlMs });
  const snapshot = lruCache.getSnapshot();

  return NextResponse.json({ ok: true, snapshot });
}
