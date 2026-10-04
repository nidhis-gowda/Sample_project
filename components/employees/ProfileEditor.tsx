"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage, ApiRequestError } from "@/hooks/useApi";
import { useToast } from "@/hooks/useToast";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select, Textarea, FormAlert } from "@/components/ui/Form";
import { EMPLOYEE_STATUSES, JOB_ROLE_LABELS, JOB_ROLES } from "@/types";
import { humanize } from "@/utils/format";
import type { EmployeeDTO } from "@/types";

/**
 * Self-service profile editor.
 *
 * The form deliberately exposes only the fields the backend accepts for
 * self-service (experience, location, availability, certifications). Changing a
 * role, department or skill level requires a manager, and the API enforces that
 * independently of this form.
 */

interface FormState {
  yearsOfExperience: string;
  location: string;
  availabilityPercent: string;
}

export function ProfileEditor({ employee }: { employee: EmployeeDTO }) {
  const router = useRouter();
  const toast = useToast();

  const [form, setForm] = React.useState<FormState>({
    yearsOfExperience: String(employee.yearsOfExperience),
    location: employee.location,
    availabilityPercent: String(employee.availabilityPercent),
  });
  const [fields, setFields] = React.useState<Record<string, string>>({});
  const [banner, setBanner] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const set =
    (key: keyof FormState) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
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

    try {
      await api.put(`/api/employees/${employee.id}`, {
        yearsOfExperience: Number(form.yearsOfExperience),
        location: form.location.trim(),
        availabilityPercent: Number(form.availabilityPercent),
      });
      toast.success("Profile updated");
      router.refresh();
    } catch (cause) {
      if (cause instanceof ApiRequestError) {
        if (cause.fields) setFields(cause.fields);
        setBanner(cause.message);
      } else {
        setBanner(errorMessage(cause));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <Card>
        <CardHeader
          title="My details"
          subtitle="Update the information you are allowed to change yourself"
        />
        <CardBody className="space-y-4">
          {banner ? <FormAlert title="Could not save your profile" message={banner} /> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Job role" htmlFor="profile-role" hint="Set by an administrator">
              <Input id="profile-role" value={JOB_ROLE_LABELS[employee.jobRole]} disabled />
            </Field>
            <Field label="Department" htmlFor="profile-department" hint="Set by an administrator">
              <Input
                id="profile-department"
                value={employee.departmentName ?? "Unassigned"}
                disabled
              />
            </Field>
            <Field
              label="Years of experience"
              htmlFor="profile-experience"
              error={fields.yearsOfExperience}
            >
              <Input
                id="profile-experience"
                type="number"
                min={0}
                max={60}
                step={0.5}
                value={form.yearsOfExperience}
                onChange={set("yearsOfExperience")}
                error={Boolean(fields.yearsOfExperience)}
              />
            </Field>
            <Field label="Location" htmlFor="profile-location" error={fields.location}>
              <Input
                id="profile-location"
                value={form.location}
                onChange={set("location")}
                error={Boolean(fields.location)}
                maxLength={120}
              />
            </Field>
            <Field
              label="Availability (%)"
              htmlFor="profile-availability"
              error={fields.availabilityPercent}
              hint="Capacity available for new project allocations."
            >
              <Input
                id="profile-availability"
                type="number"
                min={0}
                max={100}
                value={form.availabilityPercent}
                onChange={set("availabilityPercent")}
                error={Boolean(fields.availabilityPercent)}
              />
            </Field>
            <Field label="Employment status" htmlFor="profile-status" hint="Set by an administrator">
              <Input id="profile-status" value={humanize(employee.status)} disabled />
            </Field>
          </div>

          <div className="flex justify-end">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </CardBody>
      </Card>
    </form>
  );
}