import { z } from "zod";
import { readQuery } from "@/lib/api/body";
import { ok, withApi } from "@/lib/api/response";
import { enforceRateLimit, READ_LIMIT } from "@/lib/api/rate-limit";
import { requirePermission } from "@/lib/auth/rbac";
import { averageUtilization, listWorkloadRows } from "@/services/workloadService";
import { UTILIZATION_BANDS } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const listSchema = z.object({
  band: z.enum(UTILIZATION_BANDS).optional(),
  search: z.string().trim().max(120).optional(),
  departmentId: z.string().trim().optional(),
  jobRole: z.string().trim().max(40).optional(),
});

/**
 * GET /api/workload
 * Live allocation totals. An EMPLOYEE only ever receives their own row.
 */
export const GET = withApi(async (request: Request) => {
  enforceRateLimit(request, { scope: "workload:read", ...READ_LIMIT });
  const user = await requirePermission("workload:read");
  const query = readQuery(request, listSchema);

  if (user.role === "EMPLOYEE") {
    if (!user.employeeId) return ok({ rows: [], summary: emptySummary(0) });
    const rows = (await listWorkloadRows({})).filter(
      (row) => row.employeeId === user.employeeId
    );
    return ok({ rows, summary: summarize(rows, 0) });
  }

  const rows = await listWorkloadRows(query);
  const average = await averageUtilization();
  return ok({ rows, summary: summarize(rows, average) });
});

function emptySummary(averageUtilizationPercent: number) {
  return {
    totalEmployees: 0,
    available: 0,
    moderate: 0,
    high: 0,
    overallocated: 0,
    averageUtilization: averageUtilizationPercent,
  };
}

function summarize(
  rows: Array<{ utilizationBand: string; totalAllocation: number }>,
  averageUtilizationPercent: number
) {
  const counts = { AVAILABLE: 0, MODERATE: 0, HIGH: 0, OVERALLOCATED: 0 };
  let total = 0;
  for (const row of rows) {
    if (row.utilizationBand in counts) {
      counts[row.utilizationBand as keyof typeof counts] += 1;
    }
    total += Math.min(row.totalAllocation, 100);
  }
  return {
    totalEmployees: rows.length,
    available: counts.AVAILABLE,
    moderate: counts.MODERATE,
    high: counts.HIGH,
    overallocated: counts.OVERALLOCATED,
    averageUtilization:
      averageUtilizationPercent ||
      (rows.length === 0 ? 0 : Math.round((total / rows.length) * 10) / 10),
  };
}