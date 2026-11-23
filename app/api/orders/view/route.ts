import { requireApiAuth } from "@/src/lib/api-auth";
import { SheetsError } from "@/src/lib/google-sheets";
import { fetchOrders } from "@/src/lib/orders-service";

export async function GET(request: Request) {
  const denied = await requireApiAuth(request);
  if (denied) return denied;

  try {
    const orders = await fetchOrders();
    return Response.json(
      { orders, syncedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof SheetsError) {
      return Response.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error("[api/orders/view]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
