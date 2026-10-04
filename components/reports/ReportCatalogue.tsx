import {
  ArrowDownTrayIcon,
  DocumentTextIcon,
  TableCellsIcon,
} from "@heroicons/react/24/outline";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { REPORT_LABELS, REPORT_TYPES, type ReportType } from "@/services/reportService";

/**
 * Report download cards.
 *
 * The links point at the API routes, which stream a CSV or a PDF built in
 * process - there is no external or paid service involved.
 */

const DESCRIPTIONS: Record<ReportType, string> = {
  allocations:
    "Every allocation with the employee's role, project, percentage and total workload.",
  "project-staffing":
    "Required versus allocated capacity per project, with live skill coverage and missing skills.",
  "skill-gaps":
    "Uncovered project requirements, sorted by how close each project is to its deadline.",
  workload: "Allocation totals and utilisation bands for every employee.",
  utilization:
    "The same utilisation data grouped for capacity planning and benchmarking.",
  "project-progress":
    "Project status, schedule, delivery progress and current team size.",
};

export function ReportCatalogue() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {REPORT_TYPES.map((type) => (
        <Card key={type} className="flex flex-col">
          <CardBody className="flex flex-1 flex-col">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <DocumentTextIcon className="h-5 w-5" aria-hidden />
            </div>
            <h2 className="mt-4 text-sm font-semibold text-ink-900">
              {REPORT_LABELS[type]}
            </h2>
            <p className="mt-1.5 flex-1 text-xs leading-relaxed text-ink-600">
              {DESCRIPTIONS[type]}
            </p>

            <div className="mt-4 flex gap-2">
              <a
                href={`/api/reports/${type}?format=csv`}
                className="btn-secondary btn-sm flex-1"
                download
              >
                <TableCellsIcon className="h-4 w-4" aria-hidden />
                CSV
              </a>
              <a
                href={`/api/reports/${type}?format=pdf`}
                className="btn-primary btn-sm flex-1"
                download
              >
                <ArrowDownTrayIcon className="h-4 w-4" aria-hidden />
                PDF
              </a>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}