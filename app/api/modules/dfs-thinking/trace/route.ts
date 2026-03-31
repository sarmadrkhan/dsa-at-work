import { NextRequest, NextResponse } from "next/server";
import {
  traceGraph,
  Graph,
} from "@/modules/01-dfs-thinking/core/dependencyTracer";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { graph, startNodeId }: { graph: Graph; startNodeId: string } = body;

  if (!graph || !startNodeId) {
    return NextResponse.json(
      { error: "graph and startNodeId are required" },
      { status: 400 },
    );
  }

  const result = traceGraph(graph, startNodeId);
  return NextResponse.json(result);
}
