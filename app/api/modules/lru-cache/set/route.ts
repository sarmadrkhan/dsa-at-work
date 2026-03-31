import { NextRequest, NextResponse } from "next/server";
import { lruCache } from "@/lib/lruCacheInstance";

export async function POST(req: NextRequest) {
  const { key, value } = await req.json();

  if (!key || value === undefined) {
    return NextResponse.json(
      { error: "key and value are required" },
      { status: 400 },
    );
  }

  lruCache.set(key, value);
  const snapshot = lruCache.getSnapshot();

  return NextResponse.json({ ok: true, snapshot });
}
