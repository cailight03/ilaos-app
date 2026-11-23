import { requireApiAuth } from "@/src/lib/api-auth";
import { getSheetRows, SheetsError } from "@/src/lib/google-sheets";

export async function GET(request: Request) {
  const denied = await requireApiAuth(request);
  if (denied) return denied;

  try {
    const { range, rows } = await getSheetRows();
    return Response.json(
      { range, rowCount: rows.length, rows },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof SheetsError) {
      return Response.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
