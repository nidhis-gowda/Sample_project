import { Types, type FilterQuery } from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { HttpError } from "@/lib/api/http-error";
import { compact, resolveSort, searchFilter } from "@/lib/db/query";
import { DepartmentModel, type DepartmentDoc } from "@/models/Department";
import { EmployeeModel } from "@/models/Employee";
import type {
  CreateDepartmentInput,
} from "@/lib/validators/skill";
import type { DepartmentDTO } from "@/types";

export interface DepartmentWithCounts extends DepartmentDTO {
  employeeCount: number;
}

function toDTO(
  doc: DepartmentDoc & { _id: Types.ObjectId },
  employeeCount = 0
): DepartmentWithCounts {
  return {
    id: String(doc._id),
    name: doc.name,
    code: doc.code,
    description: doc.description ?? undefined,
    employeeCount,
  };
}

export async function listDepartments(params?: {
  q?: string;
  sort?: string;
  direction?: "asc" | "desc";
}): Promise<DepartmentWithCounts[]> {
  await connectDB();

  const filter: FilterQuery<DepartmentDoc> = {
    ...searchFilter<DepartmentDoc>(params?.q, ["name", "code", "description"]),
  };
  const sort = resolveSort<DepartmentDoc>(
    params?.sort,
    { name: "name", code: "code" } as unknown as Record<string, keyof DepartmentDoc & string>,
    "name",
    params?.direction ?? "asc"
  );

  const [docs, counts] = await Promise.all([
    DepartmentModel.find(filter).sort(sort).lean(),
    EmployeeModel.aggregate<{ _id: Types.ObjectId | null; count: number }>([
      { $group: { _id: "$departmentId", count: { $sum: 1 } } },
    ]),
  ]);

  const countMap = new Map(counts.map((row) => [row._id ? String(row._id) : "", row.count]));
  return docs.map((doc) =>
    toDTO(doc as DepartmentDoc & { _id: Types.ObjectId }, countMap.get(String(doc._id)) ?? 0)
  );
}

export async function getDepartmentById(id: string): Promise<DepartmentWithCounts> {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) {
    throw HttpError.badRequest("Invalid department identifier.");
  }
  const doc = await DepartmentModel.findById(id).lean();
  if (!doc) throw HttpError.notFound("That department does not exist.");
  const employeeCount = await EmployeeModel.countDocuments({ departmentId: id });
  return toDTO(doc as DepartmentDoc & { _id: Types.ObjectId }, employeeCount);
}

export async function createDepartment(
  input: CreateDepartmentInput
): Promise<DepartmentWithCounts> {
  await connectDB();
  const doc = await DepartmentModel.create({
    name: input.name,
    code: input.code,
    description: input.description ?? undefined,
    location: input.location ?? undefined,
  });
  return toDTO(doc.toObject() as DepartmentDoc & { _id: Types.ObjectId });
}

export async function updateDepartment(
  id: string,
  input: Partial<CreateDepartmentInput>
): Promise<DepartmentWithCounts> {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) {
    throw HttpError.badRequest("Invalid department identifier.");
  }
  const doc = await DepartmentModel.findByIdAndUpdate(
    id,
    { $set: compact(input) },
    { new: true, runValidators: true }
  ).lean();
  if (!doc) throw HttpError.notFound("That department does not exist.");
  const employeeCount = await EmployeeModel.countDocuments({ departmentId: id });
  return toDTO(doc as DepartmentDoc & { _id: Types.ObjectId }, employeeCount);
}

export async function deleteDepartment(id: string): Promise<void> {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) {
    throw HttpError.badRequest("Invalid department identifier.");
  }
  const employeeCount = await EmployeeModel.countDocuments({ departmentId: id });
  if (employeeCount > 0) {
    throw HttpError.conflict(
      `${employeeCount} employee(s) still belong to this department. Reassign them first.`
    );
  }
  const result = await DepartmentModel.findByIdAndDelete(id);
  if (!result) throw HttpError.notFound("That department does not exist.");
}