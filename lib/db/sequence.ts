import { EmployeeModel } from "@/models/Employee";
import { ProjectModel } from "@/models/Project";

/**
 * Generates the next human readable employee code (EMP-0001, EMP-0002, ...).
 * Zero padded so that lexicographic ordering matches numeric ordering.
 */
export async function nextEmployeeId(maxAttempts = 5): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const last = await EmployeeModel.findOne({}, { employeeId: 1 })
      .sort({ employeeId: -1 })
      .lean<{ employeeId?: string } | null>();

    const current = last?.employeeId
      ? Number.parseInt(last.employeeId.replace(/\D/g, ""), 10)
      : 0;
    const candidate = `EMP-${String((Number.isFinite(current) ? current : 0) + 1 + attempt).padStart(4, "0")}`;

    const exists = await EmployeeModel.exists({ employeeId: candidate });
    if (!exists) return candidate;
  }
  // Extremely unlikely fallback that still satisfies the unique index.
  return `EMP-${Date.now().toString().slice(-6)}`;
}

/** Generates the next project code (PRJ-0001, PRJ-0002, ...). */
export async function nextProjectCode(prefix = "PRJ", maxAttempts = 5): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const last = await ProjectModel.findOne({}, { code: 1 })
      .sort({ code: -1 })
      .lean<{ code?: string } | null>();

    const current = last?.code ? Number.parseInt(last.code.replace(/\D/g, ""), 10) : 0;
    const candidate = `${prefix}-${String(
      (Number.isFinite(current) ? current : 0) + 1 + attempt
    ).padStart(4, "0")}`;

    const exists = await ProjectModel.exists({ code: candidate });
    if (!exists) return candidate;
  }
  return `${prefix}-${Date.now().toString().slice(-6)}`;
}