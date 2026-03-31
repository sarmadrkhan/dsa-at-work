import { NextResponse } from "next/server";
import { lruCache } from "@/lib/lruCacheInstance";

export async function GET() {
  lruCache.purgeExpired();
  return NextResponse.json(lruCache.getSnapshot());
}
