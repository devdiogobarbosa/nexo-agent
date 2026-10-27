import { NextResponse } from "next/server";
import { jsonError, requireRole } from "@/server/http";
import { services } from "@/server/services";

export async function GET(request: Request) {
  try {
    const analyst = await requireRole("analista");
    const url = new URL(request.url);
    const { conversations } = await services();
    const items = await conversations.listForAnalyst(
      analyst.id,
      url.searchParams.get("filtro") ?? "todas",
      url.searchParams.get("q") ?? "",
    );
    return NextResponse.json({ conversations: items });
  } catch (error) {
    return jsonError(error);
  }
}
