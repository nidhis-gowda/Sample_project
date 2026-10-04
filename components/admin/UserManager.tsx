"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import { Input, Select } from "@/components/ui/Form";
import { ConfirmDialog } from "@/components/ui/Modal";
import {
  USER_ROLES,
  USER_ROLE_LABELS,
  type UserRole,
} from "@/types";
import { ROLE_STYLES } from "@/utils/badges";
import { formatDateTime } from "@/utils/format";

/** Administer user accounts and roles. ADMIN only, enforced server-side. */

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  employeeId: string | null;
  lastLoginAt: string | null;
}

export function UserManager({ currentUserId }: { currentUserId: string }) {
  const router = useRouter();
  const toast = useToast();

  const [search, setSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("");
  const [pendingDisable, setPendingDisable] = React.useState<UserRow | null>(null);
  const [busy, setBusy] = React.useState(false);

  const debounced = useDebounced(search, 300);
  const query = new URLSearchParams();
  if (debounced.trim()) query.set("q", debounced.trim());
  if (roleFilter) query.set("q", roleFilter);

  const { data, meta, loading, error, reload } = useApiData<UserRow[]>(
    `/api/admin/users${query.toString() ? `?${query}` : ""}`
  );
  const users = data ?? [];

  const changeRole = async (user: UserRow, role: UserRole) => {
    try {
      await api.patch("/api/admin/users", { userId: user.id, role });
      toast.success(`${user.name} is now ${USER_ROLE_LABELS[role]}`);
      reload();
      router.refresh();
    } catch (cause) {
      toast.error(
        "Could not change the role",
        cause instanceof ApiRequestError && cause.status === 403
          ? "You cannot change your own role."
          : errorMessage(cause)
      );
    }
  };

  const toggleActive = async (user: UserRow) => {
    try {
      await api.patch("/api/admin/users", {
        userId: user.id,
        isActive: !user.isActive,
      });
      toast.success(
        `${user.name} ${user.isActive ? "deactivated" : "reactivated"}`
      );
      reload();
    } catch (cause) {
      toast.error("Could not update the account", errorMessage(cause));
    }
  };

  const confirmDisable = async () => {
    if (!pendingDisable) return;
    setBusy(true);
    await toggleActive(pendingDisable);
    setBusy(false);
    setPendingDisable(null);
  };

  return (
    <Card>
      <CardHeader
        title="User accounts"
        subtitle={
          loading
            ? "Loading..."
            : `${users.length} account(s) · ${Number(meta?.admins ?? 0)} admin, ${Number(
                meta?.managers ?? 0
              )} manager, ${Number(meta?.employees ?? 0)} employee`
        }
      />

      <div className="grid gap-3 border-b border-ink-200 p-4 sm:grid-cols-2">
        <div>
          <label htmlFor="user-search" className="label">
            Search
          </label>
          <Input
            id="user-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, email or role"
          />
        </div>
        <div>
          <label htmlFor="user-role-filter" className="label">
            Role
          </label>
          <Select
            id="user-role-filter"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
          >
            <option value="">Any role</option>
            {USER_ROLES.map((role) => (
              <option key={role} value={role}>
                {USER_ROLE_LABELS[role]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {loading && !data ? (
        <TableSkeleton rows={8} columns={5} />
      ) : error ? (
        <ErrorState message={error} />
      ) : users.length === 0 ? (
        <EmptyState
          title="No accounts found"
          description="Accounts appear here after someone signs in with Google for the first time."
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Employee profile</th>
                <th>Last sign-in</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <p className="font-medium text-ink-900">{user.name}</p>
                    <p className="text-xs text-ink-500">{user.email}</p>
                    {!user.isActive ? (
                      <Badge className="badge-danger mt-1">Deactivated</Badge>
                    ) : null}
                  </td>
                  <td>
                    <Badge className={ROLE_STYLES[user.role] ?? "badge-neutral"}>
                      {USER_ROLE_LABELS[user.role as UserRole]}
                    </Badge>
                  </td>
                  <td className="text-sm">
                    {user.employeeId ? (
                      <a href={`/employees/${user.employeeId}`} className="link">
                        View profile
                      </a>
                    ) : (
                      <span className="text-ink-400">Not linked</span>
                    )}
                  </td>
                  <td className="text-sm text-ink-600">
                    {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Never"}
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Select
                        aria-label={`Role for ${user.name}`}
                        value={user.role}
                        disabled={user.id === currentUserId}
                        onChange={(event) =>
                          changeRole(user, event.target.value as UserRole)
                        }
                        className="h-8 w-auto py-0 text-xs"
                      >
                        {USER_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {USER_ROLE_LABELS[role]}
                          </option>
                        ))}
                      </Select>
                      <button
                        type="button"
                        className="btn-secondary btn-xs"
                        disabled={user.id === currentUserId}
                        title={
                          user.id === currentUserId
                            ? "You cannot deactivate your own account"
                            : undefined
                        }
                        onClick={() => setPendingDisable(user)}
                      >
                        {user.isActive ? "Deactivate" : "Reactivate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={pendingDisable !== null}
        busy={busy}
        title={pendingDisable?.isActive ? "Deactivate account" : "Reactivate account"}
        confirmLabel={pendingDisable?.isActive ? "Deactivate" : "Reactivate"}
        message={
          pendingDisable?.isActive ? (
            <p>
              <strong>{pendingDisable?.name}</strong> will no longer be able to sign in.
              Their employee profile, allocations and history are kept.
            </p>
          ) : (
            <p>
              <strong>{pendingDisable?.name}</strong> will be able to sign in again.
            </p>
          )
        }
        onCancel={() => setPendingDisable(null)}
        onConfirm={confirmDisable}
      />
    </Card>
  );
}