import { NextResponse } from "next/server";
import { retryQueue } from "@/lib/retryQueueInstance";

export async function POST() {
  await retryQueue.drain();
  return NextResponse.json({ ok: true });
}
