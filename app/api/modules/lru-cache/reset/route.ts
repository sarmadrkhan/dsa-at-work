import { NextResponse } from "next/server";
import { lruCache } from "@/lib/lruCacheInstance";

export async function POST() {
  lruCache.reset();
  return NextResponse.json({ ok: true });
}
