"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage, ApiRequestError } from "@/hooks/useApi";
import { useToast } from "@/hooks/useToast";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select, Textarea, FormAlert } from "@/components/ui/Form";
import { SkillEditor, toRows, type SkillRow } from "@/components/employees/SkillEditor";
import {
  JOB_ROLE_LABELS,
  JOB_ROLES,
  EMPLOYEE_STATUSES,
  type EmployeeDTO,
} from "@/types";
import { humanize } from "@/utils/format";

/**
 * Create / edit employee form.
 *
 * Server-side Zod errors come back as `fields` and are rendered inline next to
 * the input that produced them; a 409 (duplicate email) is shown as a banner.
 */

interface FormState {
  name: string;
  email: string;
  departmentId: string;
  jobRole: string;
  status: string;
  yearsOfExperience: string;
  location: string;
  availabilityPercent: string;
  notes: string;
}

const EMPTY: FormState = {
  name: "",
  email: "",
  departmentId: "",
  jobRole: "BACKEND_DEVELOPER",
  status: "ACTIVE",
  yearsOfExperience: "0",
  location: "Remote",
  availabilityPercent: "100",
  notes: "",
};

function fromEmployee(employee: EmployeeDTO): FormState {
  return {
    name: employee.name,
    email: employee.email,
    departmentId: employee.departmentId ?? "",
    jobRole: employee.jobRole,
    status: employee.status,
    yearsOfExperience: String(employee.yearsOfExperience),
    location: employee.location,
    availabilityPercent: String(employee.availabilityPercent),
    notes: "",
  };
}

export function EmployeeForm({
  employee,
  departments,
  skills,
}: {
  /** null => create mode */
  employee: EmployeeDTO | null;
  departments: Array<{ id: string; name: string }>;
  skills: Array<{ id: string; name: string; category: string }>;
}) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = Boolean(employee);

  const [form, setForm] = React.useState<FormState>(employee ? fromEmployee(employee) : EMPTY);
  const [skillRows, setSkillRows] = React.useState<SkillRow[]>(
    employee ? toRows(employee.skills) : []
  );
  const [fields, setFields] = React.useState<Record<string, string>>({});
  const [banner, setBanner] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const set =
    (key: keyof FormState) =>
    (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >
    ) => {
      setForm((current) => ({ ...current, [key]: event.target.value }));
      setFields((current) => {
        if (!current[key]) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });
    };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setBanner(null);
    setFields({});

    const payload = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      departmentId: form.departmentId || null,
      jobRole: form.jobRole,
      status: form.status,
      yearsOfExperience: Number(form.yearsOfExperience),
      location: form.location.trim(),
      availabilityPercent: Number(form.availabilityPercent),
      notes: form.notes.trim() || null,
      skills: skillRows,
    };

    try {
      if (employee) {
        await api.put(`/api/employees/${employee.id}`, payload);
        toast.success("Employee updated");
        router.push(`/employees/${employee.id}`);
        router.refresh();
      } else {
        const { data } = await api.post<EmployeeDTO>("/api/employees", payload);
        toast.success("Employee created");
        router.push(`/employees/${data.id}`);
        router.refresh();
      }
    } catch (cause) {
      if (cause instanceof ApiRequestError) {
        if (cause.fields) setFields(cause.fields);
        setBanner(cause.message);
      } else {
        setBanner(errorMessage(cause));
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  };
return (
    <form onSubmit={submit} className="space-y-6">
      {banner ? <FormAlert title="Could not save the employee" message={banner} /> : null}

      <Card>
        <CardHeader
          title="Personal details"
          subtitle="Who this person is and how to reach them"
        />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="name" required error={fields.name}>
            <Input
              id="name"
              value={form.name}
              onChange={set("name")}
              error={Boolean(fields.name)}
              placeholder="Alex Morgan"
              required
            />
          </Field>

          <Field
            label="Work email"
            htmlFor="email"
            required
            error={fields.email}
            hint={isEdit ? undefined : "Used to link the employee to a Google account."}
          >
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={set("email")}
              error={Boolean(fields.email)}
              placeholder="alex.morgan@company.com"
              required
            />
          </Field>

          <Field label="Job role" htmlFor="jobRole" required error={fields.jobRole}>
            <Select id="jobRole" value={form.jobRole} onChange={set("jobRole")}>
              {JOB_ROLES.map((role) => (
                <option key={role} value={role}>
                  {JOB_ROLE_LABELS[role]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Department" htmlFor="departmentId" error={fields.departmentId}>
            <Select
              id="departmentId"
              value={form.departmentId}
              onChange={set("departmentId")}
            >
              <option value="">Unassigned</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Location" htmlFor="location" error={fields.location}>
            <Input
              id="location"
              value={form.location}
              onChange={set("location")}
              error={Boolean(fields.location)}
              placeholder="Bengaluru / Remote"
            />
          </Field>

          <Field label="Employment status" htmlFor="status" error={fields.status}>
            <Select id="status" value={form.status} onChange={set("status")}>
              {EMPLOYEE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {humanize(status)}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Years of experience"
            htmlFor="yearsOfExperience"
            error={fields.yearsOfExperience}
          >
            <Input
              id="yearsOfExperience"
              type="number"
              min={0}
              max={60}
              step={0.5}
              value={form.yearsOfExperience}
              onChange={set("yearsOfExperience")}
              error={Boolean(fields.yearsOfExperience)}
            />
          </Field>

          <Field
            label="Availability (%)"
            htmlFor="availabilityPercent"
            error={fields.availabilityPercent}
            hint="Capacity available for new allocations."
          >
            <Input
              id="availabilityPercent"
              type="number"
              min={0}
              max={100}
              value={form.availabilityPercent}
              onChange={set("availabilityPercent")}
              error={Boolean(fields.availabilityPercent)}
            />
          </Field>

          <Field className="sm:col-span-2" label="Notes" htmlFor="notes" error={fields.notes}>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={set("notes")}
              error={Boolean(fields.notes)}
              placeholder="Anything a project manager should know."
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Skills"
          subtitle="Proficiency 1 (Beginner) to 5 (Expert) — these drive the matching score"
        />
        <CardBody>
          <SkillEditor
            rows={skillRows}
            onChange={setSkillRows}
            availableSkills={skills}
            disabled={saving}
            error={fields.skills}
          />
        </CardBody>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => router.back()}
          disabled={saving}
        >
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create employee"}
        </button>
      </div>
    </form>
  );
}