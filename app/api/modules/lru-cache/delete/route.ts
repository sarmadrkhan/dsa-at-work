import { NextRequest, NextResponse } from "next/server";
import { lruCache } from "@/lib/lruCacheInstance";

export async function DELETE(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");

  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  const deleted = lruCache.delete(key);
  const snapshot = lruCache.getSnapshot();

  return NextResponse.json({ ok: deleted, snapshot });
}
