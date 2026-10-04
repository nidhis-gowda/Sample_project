"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage, ApiRequestError } from "@/hooks/useApi";
import { useApiData } from "@/hooks/useApiData";
import { useToast } from "@/hooks/useToast";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, FormAlert, Input, Select } from "@/components/ui/Form";
import { MATCH_COMPONENT_LABELS, MATCH_WEIGHTS, type MatchComponentKey } from "@/types/matching";

/** System settings (ADMIN only). */

interface SettingsDTO {
  defaultNewUserRole: "EMPLOYEE" | "PROJECT_MANAGER";
  defaultAvailabilityPercent: number;
  maxWorkloadBeforeWarning: number;
  deadlineWarningDays: number;
  matchingWeights: Record<MatchComponentKey, number>;
  updatedAt?: string;
}

export function SettingsEditor() {
  const router = useRouter();
  const toast = useToast();
  const { data, loading, error, reload } = useApiData<SettingsDTO>("/api/admin/settings");

  const [form, setForm] = React.useState<SettingsDTO | null>(null);
  const [banner, setBanner] = React.useState<string | null>(null);
  const [fields, setFields] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (data && !form) setForm(data);
  }, [data, form]);

  if (loading && !data) {
    return (
      <Card>
        <CardHeader title="System settings" subtitle="Loading..." />
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardBody>
          <FormAlert title="Could not load settings" message={error} />
        </CardBody>
      </Card>
    );
  }

  if (!form) return null;

  const totalWeight = Object.values(form.matchingWeights).reduce((a, b) => a + b, 0);

  const setValue = <K extends keyof SettingsDTO>(key: K, value: SettingsDTO[K]) => {
    setForm({ ...form, [key]: value });
    setFields((current) => {
      if (!current[key as string]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setBanner(null);
    setFields({});

    try {
      await api.put("/api/admin/settings", {
        defaultNewUserRole: form.defaultNewUserRole,
        defaultAvailabilityPercent: Number(form.defaultAvailabilityPercent),
        maxWorkloadBeforeWarning: Number(form.maxWorkloadBeforeWarning),
        deadlineWarningDays: Number(form.deadlineWarningDays),
        matchingWeights: Object.fromEntries(
          Object.entries(form.matchingWeights).map(([key, value]) => [
            key,
            Number((Number(value) * 100).toFixed(0)) / 100,
          ])
        ),
      });
      toast.success("Settings saved");
      reload();
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
    <form onSubmit={save} className="space-y-6">
      {banner ? <FormAlert title="Could not save the settings" message={banner} /> : null}

      <Card>
        <CardHeader
          title="New accounts"
          subtitle="Defaults applied when someone signs in for the first time"
        />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Default role for new users"
            htmlFor="default-role"
            error={fields.defaultNewUserRole}
            hint="ADMIN accounts must be promoted manually."
          >
            <Select
              id="default-role"
              value={form.defaultNewUserRole}
              onChange={(event) =>
                setValue(
                  "defaultNewUserRole",
                  event.target.value as "EMPLOYEE" | "PROJECT_MANAGER"
                )
              }
            >
              <option value="EMPLOYEE">Employee</option>
              <option value="PROJECT_MANAGER">Project Manager</option>
            </Select>
          </Field>

          <Field
            label="Default availability (%)"
            htmlFor="default-availability"
            error={fields.defaultAvailabilityPercent}
          >
            <Input
              id="default-availability"
              type="number"
              min={0}
              max={100}
              value={form.defaultAvailabilityPercent}
              onChange={(event) =>
                setValue("defaultAvailabilityPercent", Number(event.target.value))
              }
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Workload and deadlines"
          subtitle="Thresholds used by the allocation warnings and dashboard"
        />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Warn above this workload (%)"
            htmlFor="max-workload"
            error={fields.maxWorkloadBeforeWarning}
          >
            <Input
              id="max-workload"
              type="number"
              min={50}
              max={200}
              value={form.maxWorkloadBeforeWarning}
              onChange={(event) =>
                setValue("maxWorkloadBeforeWarning", Number(event.target.value))
              }
            />
          </Field>
          <Field
            label="Deadline warning (days)"
            htmlFor="deadline-days"
            error={fields.deadlineWarningDays}
          >
            <Input
              id="deadline-days"
              type="number"
              min={1}
              max={60}
              value={form.deadlineWarningDays}
              onChange={(event) => setValue("deadlineWarningDays", Number(event.target.value))}
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Matching weights"
          subtitle="How the System Matching Score is composed"
        />
        <CardBody className="space-y-4">
          {(Object.keys(MATCH_WEIGHTS) as MatchComponentKey[]).map((key) => (
            <Field
              key={key}
              label={`${MATCH_COMPONENT_LABELS[key]} (%)`}
              htmlFor={`weight-${key}`}
            >
              <Input
                id={`weight-${key}`}
                type="number"
                min={0}
                max={100}
                step={1}
                value={Math.round(form.matchingWeights[key] * 100)}
                onChange={(event) =>
                  setValue("matchingWeights", {
                    ...form.matchingWeights,
                    [key]: Number(event.target.value) / 100,
                  })
                }
              />
            </Field>
          ))}

          <p
            className={
              Math.abs(totalWeight - 1) < 0.001
                ? "rounded-lg bg-success-soft px-3.5 py-2.5 text-sm text-success-ink"
                : "rounded-lg bg-danger-soft px-3.5 py-2.5 text-sm text-danger-ink"
            }
          >
            Weights total {Math.round(totalWeight * 100)}%.{" "}
            {Math.abs(totalWeight - 1) < 0.001
              ? "The score is well formed."
              : "The weights must add up to exactly 100%."}
          </p>
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Saving..." : "Save settings"}
        </button>
      </div>
    </form>
  );
}