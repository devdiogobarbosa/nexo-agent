import { NextResponse } from "next/server";
import { jsonError, requireRole } from "@/server/http";
import { services } from "@/server/services";

export async function GET() {
  try {
    const user = await requireRole("funcionario");
    const { tickets } = await services();
    const mine = await tickets.listByRequester(user.id);
    return NextResponse.json({ tickets: mine });
  } catch (error) {
    return jsonError(error);
  }
}
