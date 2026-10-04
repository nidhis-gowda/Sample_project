import { z } from "zod";
import { withApi } from "@/lib/api/response";
import { HttpError } from "@/lib/api/http-error";
import { readQuery } from "@/lib/api/body";
import { enforceRateLimit, READ_LIMIT } from "@/lib/api/rate-limit";
import { requirePermission } from "@/lib/auth/rbac";
import {
  isReportType,
  renderCsv,
  renderPdf,
  REPORT_TYPES,
  type ReportType,
} from "@/services/reportService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  format: z.enum(["csv", "pdf"]).default("csv"),
});

type Context = { params: Promise<{ type: string }> };

function filename(type: ReportType, format: "csv" | "pdf"): string {
  return `${type}-report-${new Date().toISOString().slice(0, 10)}.${format}`;
}

/** GET /api/reports/:type?format=csv|pdf — streams a downloadable report. */
export const GET = withApi(async (request: Request, context: Context) => {
  enforceRateLimit(request, { scope: "reports", ...READ_LIMIT });
  const user = await requirePermission("report:read");

  const { type } = await context.params;
  if (!isReportType(type)) {
    throw HttpError.notFound(
      `Unknown report "${type}". Available reports: ${REPORT_TYPES.join(", ")}.`
    );
  }

  const { format } = readQuery(request, querySchema);
  const name = filename(type, format);

  if (format === "pdf") {
    const bytes = await renderPdf(type, user);
    return new Response(bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const csv = await renderCsv(type, user);
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
});