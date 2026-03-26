import { NextRequest, NextResponse } from "next/server";
import { retryQueue } from "@/lib/retryQueueInstance";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const {
    batchSize = 10,
    failRate = 0.4,
    maxRetries = 4,
    maxConcurrency = 3,
    baseDelayMs = 500,
    backoffStrategy = "exponential",
  } = body;

  // Reset and reconfigure the queue with the incoming settings
  retryQueue.reset();
  retryQueue.configure({
    maxConcurrency,
    maxRetries,
    baseDelayMs,
    backoffStrategy,
    failRate,
  });

  // Build the batch of fake payloads - simulates real job data
  const payloads = Array.from({ length: batchSize }, (_, i) => ({
    jobIndex: i + 1,
    endpoint: "/api/downstream/notify",
    firedAt: Date.now(),
  }));

  retryQueue.enqueue(payloads);

  // Fire and forget - process runs async, UI polls status
  retryQueue.process();

  return NextResponse.json({ ok: true, queued: batchSize });
}
