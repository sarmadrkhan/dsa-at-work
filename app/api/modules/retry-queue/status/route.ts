import { NextResponse } from "next/server";
import { retryQueue } from "@/lib/retryQueueInstance";

export async function GET() {
  return NextResponse.json({
    jobs: retryQueue.getJobs(),
    metrics: retryQueue.getMetrics(),
  });
}
