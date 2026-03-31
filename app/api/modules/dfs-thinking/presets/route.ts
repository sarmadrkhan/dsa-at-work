import { NextResponse } from "next/server";
import { PRESET_GRAPHS } from "@/modules/01-dfs-thinking/core/dependencyTracer";

export async function GET() {
  // Strip the full graph data from the list response - only send metadata.
  // The full graph is fetched separately when a preset is selected.
  const presets = Object.entries(PRESET_GRAPHS).map(([key, value]) => ({
    key,
    label: value.label,
    description: value.description,
    startNodeId: value.startNodeId,
    nodeCount: value.graph.nodes.length,
  }));

  return NextResponse.json(presets);
}
