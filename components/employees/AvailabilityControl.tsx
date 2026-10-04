"use client";

import * as React from "react";
import { PencilSquareIcon } from "@heroicons/react/24/outline";
import { api, errorMessage } from "@/hooks/useApi";
import { useApiData } from "@/hooks/useApiData";
import { useToast } from "@/hooks/useToast";
import { Badge, Card, CardBody, CardHeader, ProgressBar } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { ProficiencyDots } from "@/components/employees/SkillEditor";
import { UTILIZATION_STYLES, workloadBarColor } from "@/utils/badges";
import { JOB_ROLE_LABELS, PROFICIENCY_LABELS } from "@/types";
import { formatDate, formatPercent } from "@/utils/format";

/** Availability control — an employee updates their own capacity here. */
export function AvailabilityControl({
  employeeId,
  initial,
  canEdit,
}: {
  employeeId: string;
  initial: number;
  canEdit: boolean;
}) {
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/api/employees/${employeeId}/availability`, {
        availabilityPercent: value,
      });
      toast.success("Availability updated");
      setOpen(false);
      window.location.reload();
    } catch (cause) {
      toast.error("Could not update availability", errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={!canEdit}
        onClick={() => {
          setValue(initial);
          setOpen(true);
        }}
        className="btn-secondary btn-xs"
        title={canEdit ? "Update availability" : "Only the employee or an admin can change this"}
      >
        <PencilSquareIcon className="h-3.5 w-3.5" aria-hidden />
        {canEdit ? "Update" : "View only"}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Set your availability"
        description="This is the capacity available for new project allocations."
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <Field
          label={`Availability: ${value}%`}
          htmlFor="availability-slider"
          hint="100% means fully available for new work. Lower it if you have other commitments."
        >
          <input
            id="availability-slider"
            type="range"
            min={0}
            max={100}
            step={5}
            value={value}
            onChange={(event) => setValue(Number(event.target.value))}
            className="w-full accent-brand-600"
          />
        </Field>
        <div className="mt-4">
          <Input
            type="number"
            min={0}
            max={100}
            value={value}
            onChange={(event) =>
              setValue(Math.max(0, Math.min(100, Number(event.target.value))))
            }
            aria-label="Availability percentage"
          />
        </div>
      </Modal>
    </>
  );
}