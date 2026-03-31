import { NextRequest, NextResponse } from "next/server";
import { PRESET_GRAPHS } from "@/modules/01-dfs-thinking/core/dependencyTracer";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const preset = PRESET_GRAPHS[key];

  if (!preset) {
    return NextResponse.json({ error: "Preset not found" }, { status: 404 });
  }

  return NextResponse.json(preset);
}
