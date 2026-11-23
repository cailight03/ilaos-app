import "server-only";
import { google, type sheets_v4 } from "googleapis";

export type SheetsErrorCode =
  | "MISSING_ENV"
  | "AUTH_FAILED"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "API_ERROR";

export class SheetsError extends Error {
  constructor(
    public readonly code: SheetsErrorCode,
    message: string,
    public readonly status: number = 500,
  ) {
    super(message);
    this.name = "SheetsError";
  }
}

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

function getConfig() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const sheetId = process.env.GOOGLE_SHEET_ID;

  const missing = [
    !clientEmail && "GOOGLE_CLIENT_EMAIL",
    !privateKey && "GOOGLE_PRIVATE_KEY",
    !sheetId && "GOOGLE_SHEET_ID",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new SheetsError(
      "MISSING_ENV",
      `Missing environment variables: ${missing.join(", ")}`,
    );
  }

  return {
    clientEmail: clientEmail!,
    // Env providers (Vercel, .env) often store newlines as literal "\n"
    // and may wrap the value in quotes.
    privateKey: privateKey!.replace(/^"|"$/g, "").replace(/\\n/g, "\n"),
    sheetId: sheetId!,
    range: process.env.GOOGLE_SHEET_RANGE || undefined,
  };
}

let cachedClient: sheets_v4.Sheets | null = null;

function getSheetsClient(config: ReturnType<typeof getConfig>) {
  if (!cachedClient) {
    const auth = new google.auth.JWT({
      email: config.clientEmail,
      key: config.privateKey,
      scopes: [SHEETS_SCOPE],
    });
    cachedClient = google.sheets({ version: "v4", auth });
  }
  return cachedClient;
}

function toSheetsError(err: unknown): SheetsError {
  if (err instanceof SheetsError) return err;

  const e = err as {
    code?: number | string;
    status?: number;
    message?: string;
  };
  const status = Number(e?.status ?? e?.code);
  const message = e?.message ?? "";

  if (
    status === 401 ||
    /invalid_grant|invalid_client|unauthorized|DECODER|PEM|private key/i.test(
      message,
    )
  ) {
    return new SheetsError(
      "AUTH_FAILED",
      "Google authentication failed. Check GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY.",
      502,
    );
  }
  if (status === 403) {
    return new SheetsError(
      "FORBIDDEN",
      "Access denied. Ensure the sheet is shared with the service account and the Sheets API is enabled.",
      502,
    );
  }
  if (status === 404) {
    return new SheetsError(
      "NOT_FOUND",
      "Spreadsheet or range not found. Check GOOGLE_SHEET_ID (and GOOGLE_SHEET_RANGE if set).",
      502,
    );
  }
  if (status === 429) {
    return new SheetsError("RATE_LIMITED", "Google Sheets rate limit hit.", 503);
  }
  return new SheetsError("API_ERROR", "Failed to read from Google Sheets.", 502);
}

export type SheetData = {
  range: string;
  rows: string[][];
  sheetTitle: string; // tab name, used to build A1 ranges for writes
};

/** "'My Tab'!A1:Z100" -> "My Tab" */
function sheetTitleFromRange(range: string): string {
  const bang = range.lastIndexOf("!");
  const raw = bang === -1 ? range : range.slice(0, bang);
  return raw.replace(/^'|'$/g, "").replace(/''/g, "'");
}

/** Writes individual cells. `ranges` are A1 ranges like "'Tab'!H2". */
export async function updateSheetCells(
  updates: { range: string; values: string[][] }[],
): Promise<void> {
  if (updates.length === 0) return;
  try {
    const config = getConfig();
    const sheets = getSheetsClient(config);
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: config.sheetId,
      requestBody: { valueInputOption: "RAW", data: updates },
    });
  } catch (err) {
    const e = toSheetsError(err);
    // A 403 on write means the service account is still a viewer.
    if (e.code === "FORBIDDEN") {
      throw new SheetsError(
        "FORBIDDEN",
        "Couldn't save to the sheet. Share it with the service account as an Editor.",
        502,
      );
    }
    console.error(`[google-sheets] write ${e.code}:`, (err as Error)?.message);
    throw e;
  }
}

/**
 * Reads raw rows (including the header row) from the spreadsheet.
 * Uses GOOGLE_SHEET_RANGE if set, otherwise the first tab.
 */
export async function getSheetRows(range?: string): Promise<SheetData> {
  try {
    const config = getConfig();
    const sheets = getSheetsClient(config);

    let target = range ?? config.range;
    if (!target) {
      const meta = await sheets.spreadsheets.get({
        spreadsheetId: config.sheetId,
        fields: "sheets.properties.title",
      });
      const title = meta.data.sheets?.[0]?.properties?.title;
      if (!title) {
        throw new SheetsError("NOT_FOUND", "Spreadsheet has no sheets.", 502);
      }
      target = `'${title.replace(/'/g, "''")}'`;
    }

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
      range: target,
      valueRenderOption: "FORMATTED_VALUE",
    });

    return {
      range: res.data.range ?? target,
      rows: (res.data.values ?? []) as string[][],
      sheetTitle: sheetTitleFromRange(res.data.range ?? target),
    };
  } catch (err) {
    const e = toSheetsError(err);
    console.error(`[google-sheets] ${e.code}:`, (err as Error)?.message);
    throw e;
  }
}
