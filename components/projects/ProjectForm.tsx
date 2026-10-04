"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage, ApiRequestError } from "@/hooks/useApi";
import { useToast } from "@/hooks/useToast";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select, Textarea, FormAlert } from "@/components/ui/Form";
import {
  RequirementsEditor,
  type RequirementRow,
} from "@/components/projects/RequirementsEditor";
import {
  JOB_ROLE_LABELS,
  JOB_ROLES,
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  type JobRole,
  type ProjectDTO,
} from "@/types";
import { humanize, toDateInputValue } from "@/utils/format";

/** Create / edit project form, including the dynamic skill requirement list. */

interface FormState {
  name: string;
  code: string;
  clientName: string;
  description: string;
  startDate: string;
  deadline: string;
  status: string;
  priority: string;
  requiredTeamSize: string;
  requiredExperienceYears: string;
  progress: string;
  managerId: string;
  preferredRoles: JobRole[];
}

function defaults(): FormState {
  const today = new Date();
  const inThreeMonths = new Date(today.getTime() + 90 * 86_400_000);
  return {
    name: "",
    code: "",
    clientName: "",
    description: "",
    startDate: toDateInputValue(today),
    deadline: toDateInputValue(inThreeMonths),
    status: "PLANNING",
    priority: "MEDIUM",
    requiredTeamSize: "3",
    requiredExperienceYears: "3",
    progress: "0",
    managerId: "",
    preferredRoles: [],
  };
}

function fromProject(project: ProjectDTO): FormState {
  return {
    name: project.name,
    code: project.code,
    clientName: project.clientName,
    description: project.description ?? "",
    startDate: toDateInputValue(project.startDate),
    deadline: toDateInputValue(project.deadline),
    status: project.status,
    priority: project.priority,
    requiredTeamSize: String(project.requiredTeamSize),
    requiredExperienceYears: String(project.requiredExperienceYears),
    progress: String(project.progress),
    managerId: project.managerId ?? "",
    preferredRoles: [],
  };
}

export function ProjectForm({
  project,
  skills,
  managers,
}: {
  /** null => create mode */
  project: ProjectDTO | null;
  skills: Array<{ id: string; name: string; category: string }>;
  managers: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = Boolean(project);

  const [form, setForm] = React.useState<FormState>(
    project ? fromProject(project) : defaults()
  );
  const [requirements, setRequirements] = React.useState<RequirementRow[]>(
    project?.requirements.map((requirement) => ({
      skillId: requirement.skillId,
      requiredProficiency: requirement.requiredProficiency,
      importance: requirement.importance,
    })) ?? []
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

  const toggleRole = (role: JobRole) => {
    setForm((current) => ({
      ...current,
      preferredRoles: current.preferredRoles.includes(role)
        ? current.preferredRoles.filter((item) => item !== role)
        : [...current.preferredRoles, role],
    }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setBanner(null);
    setFields({});

    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      clientName: form.clientName.trim(),
      description: form.description.trim() || null,
      startDate: form.startDate,
      deadline: form.deadline,
      status: form.status,
      priority: form.priority,
      requiredTeamSize: Number(form.requiredTeamSize),
      requiredExperienceYears: Number(form.requiredExperienceYears),
      progress: Number(form.progress),
      managerId: form.managerId || null,
      preferredRoles: form.preferredRoles,
      requirements,
    };

    try {
      if (project) {
        await api.put(`/api/projects/${project.id}`, payload);
        toast.success("Project updated");
        router.push(`/projects/${project.id}`);
      } else {
        const { data } = await api.post<ProjectDTO>("/api/projects", payload);
        toast.success("Project created");
        router.push(`/projects/${data.id}`);
      }
      router.refresh();
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
      {banner ? <FormAlert title="Could not save the project" message={banner} /> : null}

      <Card>
        <CardHeader title="Project details" subtitle="Identity, schedule and sizing" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Project name" htmlFor="name" required error={fields.name}>
            <Input
              id="name"
              value={form.name}
              onChange={set("name")}
              error={Boolean(fields.name)}
              placeholder="Banking Application Modernisation"
              required
            />
          </Field>

          <Field
            label="Project code"
            htmlFor="code"
            required
            error={fields.code}
            hint="Unique short reference, e.g. PRJ-0001"
          >
            <Input
              id="code"
              value={form.code}
              onChange={set("code")}
              error={Boolean(fields.code)}
              placeholder="PRJ-0001"
              required
            />
          </Field>

          <Field label="Client" htmlFor="clientName" required error={fields.clientName}>
            <Input
              id="clientName"
              value={form.clientName}
              onChange={set("clientName")}
              error={Boolean(fields.clientName)}
              placeholder="Northwind Bank"
              required
            />
          </Field>

          <Field label="Project manager" htmlFor="managerId" error={fields.managerId}>
            <Select id="managerId" value={form.managerId} onChange={set("managerId")}>
              <option value="">Assign me on save</option>
              {managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Start date" htmlFor="startDate" required error={fields.startDate}>
            <Input
              id="startDate"
              type="date"
              value={form.startDate}
              onChange={set("startDate")}
              error={Boolean(fields.startDate)}
              required
            />
          </Field>

          <Field
            label="Deadline"
            htmlFor="deadline"
            required
            error={fields.deadline}
            hint="A deadline within 14 days raises the experience expectation."
          >
            <Input
              id="deadline"
              type="date"
              value={form.deadline}
              onChange={set("deadline")}
              error={Boolean(fields.deadline)}
              required
            />
          </Field>

          <Field label="Status" htmlFor="status" required error={fields.status}>
            <Select id="status" value={form.status} onChange={set("status")}>
              {PROJECT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {humanize(status)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Priority" htmlFor="priority" required error={fields.priority}>
            <Select id="priority" value={form.priority} onChange={set("priority")}>
              {PROJECT_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {humanize(priority)}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Required team size"
            htmlFor="requiredTeamSize"
            required
            error={fields.requiredTeamSize}
          >
            <Input
              id="requiredTeamSize"
              type="number"
              min={1}
              max={200}
              value={form.requiredTeamSize}
              onChange={set("requiredTeamSize")}
              error={Boolean(fields.requiredTeamSize)}
              required
            />
          </Field>

          <Field
            label="Minimum experience (years)"
            htmlFor="requiredExperienceYears"
            error={fields.requiredExperienceYears}
          >
            <Input
              id="requiredExperienceYears"
              type="number"
              min={0}
              max={30}
              step={0.5}
              value={form.requiredExperienceYears}
              onChange={set("requiredExperienceYears")}
              error={Boolean(fields.requiredExperienceYears)}
            />
          </Field>

          <Field label="Progress (%)" htmlFor="progress" error={fields.progress}>
            <Input
              id="progress"
              type="number"
              min={0}
              max={100}
              value={form.progress}
              onChange={set("progress")}
              error={Boolean(fields.progress)}
            />
          </Field>

          <Field
            className="sm:col-span-2"
            label="Description"
            htmlFor="description"
            error={fields.description}
          >
            <Textarea
              id="description"
              value={form.description}
              onChange={set("description")}
              error={Boolean(fields.description)}
              placeholder="Scope, outcomes and any constraints a manager should know about."
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Preferred job roles"
          subtitle="Optional. Improves the Role Suitability component of the score."
        />
        <CardBody>
          <div className="flex flex-wrap gap-2">
            {JOB_ROLES.map((role) => {
              const active = form.preferredRoles.includes(role);
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  aria-pressed={active}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-ink-300 bg-white text-ink-700 hover:bg-ink-50"
                  }`}
                >
                  {JOB_ROLE_LABELS[role]}
                </button>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Required skills"
          subtitle="Proficiency 1 (Beginner) to 5 (Expert). These drive the matching engine."
        />
        <CardBody>
          <RequirementsEditor
            rows={requirements}
            onChange={setRequirements}
            availableSkills={skills}
            disabled={saving}
          />
          {fields.requirements ? (
            <p className="field-error mt-3" role="alert">
              {fields.requirements}
            </p>
          ) : null}
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
          {saving ? "Saving..." : isEdit ? "Save changes" : "Create project"}
        </button>
      </div>
    </form>
  );
}