import { NextResponse, type NextRequest } from "next/server";
import { runLoader } from "@/lib/query/server";

// What the browser cache fetches (see src/lib/query/data.ts).
export async function GET(request: NextRequest, { params }: RouteContext<"/api/data/[module]/[name]">) {
  const { module, name } = await params;
  try {
    const data = await runLoader({ module, name, params: Object.fromEntries(request.nextUrl.searchParams) });
    return NextResponse.json(data ?? null, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    const status = message === "Not signed in" ? 401 : message.startsWith("Unknown loader") ? 404 : 500;
    if (status === 500) console.error(`Loader ${module}/${name} failed:`, error);
    return NextResponse.json({ error: message }, { status });
  }
}
