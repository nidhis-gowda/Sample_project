import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/rbac";
import { ReportCatalogue } from "@/components/reports/ReportCatalogue";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  await requirePageUser("report:read");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="section-title">Reports</h1>
        <p className="section-subtitle">
          Downloadable CSV and PDF reports, generated on demand from live data. Both
          formats are produced in-process with no paid service and no scheduled job.
        </p>
      </header>

      <ReportCatalogue />

      <div className="rounded-xl border border-ink-200 bg-ink-50 p-5">
        <h2 className="text-sm font-semibold text-ink-900">About these reports</h2>
        <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-ink-600">
          <li>
            Each file records the generating user and a UTC timestamp in its header.
          </li>
          <li>
            An EMPLOYEE only receives rows for their own allocations - the same scope
            the API enforces when listing data.
          </li>
          <li>
            PDF files are rendered with <code className="font-mono">pdf-lib</code>; CSV
            files are produced by a small built-in writer. Nothing is sent to an external
            service.
          </li>
        </ul>
      </div>
    </div>
  );
}