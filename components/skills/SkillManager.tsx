"use client";

import * as React from "react";
import { PlusIcon } from "@heroicons/react/24/outline";
import { api, errorMessage, ApiRequestError } from "@/hooks/useApi";
import { useApiData, useDebounced } from "@/hooks/useApiData";
import { useToast } from "@/hooks/useToast";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  TableSkeleton,
} from "@/components/ui/Card";
import { Field, Input, Select, Textarea, FormAlert } from "@/components/ui/Form";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { SKILL_CATEGORIES } from "@/types";

/** Skill catalogue with search, category filter and inline create/edit/delete. */

interface SkillRow {
  id: string;
  name: string;
  category: string;
  description?: string;
  employeeCount: number;
}

const EMPTY_FORM = { name: "", category: "Programming", description: "" };

export function SkillManager({ canManage }: { canManage: boolean }) {
  const toast = useToast();
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("");

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SkillRow | null>(null);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [fields, setFields] = React.useState<Record<string, string>>({});
  const [banner, setBanner] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<SkillRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const debounced = useDebounced(search, 300);

  const query = new URLSearchParams({ pageSize: "200", sort: "name" });
  if (debounced.trim()) query.set("q", debounced.trim());
  if (category) query.set("category", category);

  const { data, loading, error, reload } = useApiData<SkillRow[]>(
    `/api/skills?${query.toString()}`
  );
  const skills = data ?? [];

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFields({});
    setBanner(null);
    setModalOpen(true);
  };

  const openEdit = (skill: SkillRow) => {
    setEditing(skill);
    setForm({
      name: skill.name,
      category: skill.category,
      description: skill.description ?? "",
    });
    setFields({});
    setBanner(null);
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setBanner(null);
    setFields({});
    try {
      if (editing) {
        await api.put(`/api/skills/${editing.id}`, form);
        toast.success(`${form.name} updated`);
      } else {
        await api.post("/api/skills", form);
        toast.success(`${form.name} added to the catalogue`);
      }
      setModalOpen(false);
      reload();
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

  const remove = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/api/skills/${pendingDelete.id}`);
      toast.success(`${pendingDelete.name} deleted`);
      setPendingDelete(null);
      reload();
    } catch (cause) {
      toast.error(
        "Could not delete the skill",
        cause instanceof ApiRequestError && cause.status === 409
          ? cause.message
          : errorMessage(cause)
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader
          title="Skill catalogue"
          subtitle={
            loading
              ? "Loading..."
              : `${skills.length} skill${skills.length === 1 ? "" : "s"} available`
          }
          actions={
            canManage ? (
              <button type="button" className="btn-primary btn-sm" onClick={openCreate}>
                <PlusIcon className="h-4 w-4" aria-hidden />
                New skill
              </button>
            ) : null
          }
        />

        <div className="grid gap-3 border-b border-ink-200 p-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label htmlFor="skill-search" className="label">
              Search
            </label>
            <Input
              id="skill-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Skill name or description"
            />
          </div>
          <div>
            <label htmlFor="skill-category" className="label">
              Category
            </label>
            <Select
              id="skill-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="">All categories</option>
              {SKILL_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {loading && !data ? (
          <TableSkeleton rows={6} columns={4} />
        ) : error ? (
          <ErrorState message={error} />
        ) : skills.length === 0 ? (
          <EmptyState
            title="No skills found"
            description={
              debounced || category
                ? "No skill matches the current search and category filter."
                : "The catalogue is empty. Add the first skill to get started."
            }
          />
        ) : (
          <SkillTable
            skills={skills}
            canManage={canManage}
            onEdit={openEdit}
            onDelete={setPendingDelete}
          />
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${editing.name}` : "Add a skill"}
        description={
          editing
            ? "Renaming keeps every existing reference intact."
            : "Skills are referenced by employees and projects, never duplicated."
        }
        size="sm"
        footer={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={save} disabled={saving}>
              {saving ? "Saving..." : editing ? "Save changes" : "Add skill"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {banner ? <FormAlert message={banner} /> : null}

          <Field label="Skill name" htmlFor="skill-name" required error={fields.name}>
            <Input
              id="skill-name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              error={Boolean(fields.name)}
              placeholder="Kubernetes"
              maxLength={80}
            />
          </Field>

          <Field
            label="Category"
            htmlFor="skill-form-category"
            required
            error={fields.category}
          >
            <Select
              id="skill-form-category"
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
            >
              {SKILL_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Description"
            htmlFor="skill-description"
            error={fields.description}
            hint="Optional. Helps managers understand what this skill covers."
          >
            <Textarea
              id="skill-description"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              error={Boolean(fields.description)}
              maxLength={600}
              placeholder="Container orchestration on Kubernetes clusters."
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        busy={deleting}
        title="Delete skill"
        confirmLabel="Delete"
        message={
          <>
            <p>
              <strong>{pendingDelete?.name}</strong> will be removed from the catalogue.
            </p>
            <p className="mt-2">
              If any employee profile or project still references it, the deletion is
              rejected so nothing is silently corrupted.
            </p>
          </>
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={remove}
      />
    </>
  );
}

/** Catalogue table, split out so the modal state above stays readable. */
function SkillTable({
  skills,
  canManage,
  onEdit,
  onDelete,
}: {
  skills: SkillRow[];
  canManage: boolean;
  onEdit: (skill: SkillRow) => void;
  onDelete: (skill: SkillRow) => void;
}) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Skill</th>
            <th>Category</th>
            <th>People with it</th>
            {canManage ? <th className="text-right">Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {skills.map((skill) => (
            <tr key={skill.id}>
              <td>
                <a href={`/skills/${skill.id}`} className="link font-medium">
                  {skill.name}
                </a>
                {skill.description ? (
                  <p className="max-w-md truncate text-xs text-ink-500">
                    {skill.description}
                  </p>
                ) : null}
              </td>
              <td>
                <Badge className="badge-brand">{skill.category}</Badge>
              </td>
              <td className="tabular-nums">{skill.employeeCount}</td>
              {canManage ? (
                <td className="text-right">
                  <div className="flex justify-end gap-1.5">
                    <a href={`/skills/${skill.id}`} className="btn-secondary btn-xs">
                      View
                    </a>
                    <button
                      type="button"
                      className="btn-secondary btn-xs"
                      onClick={() => onEdit(skill)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-xs text-danger hover:bg-danger-soft"
                      onClick={() => onDelete(skill)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}