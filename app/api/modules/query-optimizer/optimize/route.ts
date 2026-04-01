import { NextRequest, NextResponse } from "next/server";
import {
  runOptimizer,
  OptimzerInput,
} from "@/modules/03-sorting-tradeoffs/core/queryOptimizer";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { dataProfile, queryType, dataSize }: OptimzerInput = body;

  if (!dataProfile || !queryType || !dataSize) {
    return NextResponse.json(
      { error: "dataProfile, queryType, and dataSize are required" },
      { status: 400 },
    );
  }

  const result = runOptimizer({ dataProfile, queryType, dataSize });
  return NextResponse.json(result);
}
