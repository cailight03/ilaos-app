import { requireApiModule } from "@/src/lib/api-auth";
import { computeDashboardStats } from "@/src/lib/dashboard";
import { getSheetRows, SheetsError } from "@/src/lib/google-sheets";
import { parseOrders } from "@/src/lib/orders";

export async function GET(request: Request) {
  const denied = await requireApiModule(request, "dashboard");
  if (denied) return denied;

  const bakeDate = new URL(request.url).searchParams.get("bakeDate");
  if (bakeDate && !/^\d{4}-\d{2}-\d{2}$/.test(bakeDate)) {
    return Response.json(
      { error: "bakeDate must be formatted as YYYY-MM-DD" },
      { status: 400 },
    );
  }

  try {
    const { rows } = await getSheetRows();
    const stats = computeDashboardStats(parseOrders(rows), bakeDate);
    return Response.json(stats, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof SheetsError) {
      return Response.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error("[api/dashboard]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
