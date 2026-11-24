"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import Image from "next/image";
import { Check, Pencil, Plus, Search, ShieldCheck, TriangleAlert } from "lucide-react";
import {
  removeUserAction,
  saveUserAction,
  setUserActiveAction,
  type ActionResult,
} from "./actions";
import type { Role } from "@/src/lib/users";
import { SheetModal } from "../_components/sheet-modal";

const ROLE_LABEL: Record<Role, string> = { owner: "Owner", admin: "Admin", staff: "Staff" };

export type UserRow = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: Role;
  isActive: boolean;
  modules: string[];
  addedAt: string;
  lastLogin: string | null;
};

type ModuleOption = { key: string; name: string };

type Editor = {
  id: string | null;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  modules: string[];
};

type Confirm = { kind: "deactivate" | "remove"; user: UserRow };

const fieldClass =
  "h-11 w-full min-w-0 rounded-xl border border-separator bg-card px-3.5 text-[17px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/25";

export function UsersManager({
  users,
  currentUserId,
  modules,
}: {
  users: UserRow[];
  currentUserId: string;
  modules: ModuleOption[];
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [role, setRole] = useState<"all" | Role>("all");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const total = users.length;
  const active = users.filter((u) => u.isActive).length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (status === "active" && !u.isActive) return false;
      if (status === "inactive" && u.isActive) return false;
      if (role !== "all" && u.role !== role) return false;
      return !q || u.email.toLowerCase().includes(q) || (u.name ?? "").toLowerCase().includes(q);
    });
  }, [users, query, status, role]);

  const run = (work: () => Promise<ActionResult>, success: string, onOk: () => void) => {
    setDialogError(null);
    startTransition(async () => {
      const result = await work();
      if (result.ok) {
        onOk();
        setToast({ ok: true, text: success });
      } else {
        setDialogError(result.error);
        setToast({ ok: false, text: result.error });
      }
    });
  };

  const openAdd = () => {
    setDialogError(null);
    setEditor({ id: null, email: "", name: "", role: "staff", isActive: true, modules: [] });
  };

  const openEdit = (u: UserRow) => {
    setDialogError(null);
    setEditor({
      id: u.id,
      email: u.email,
      name: u.name ?? "",
      role: u.role,
      isActive: u.isActive,
      modules: u.modules,
    });
  };

  const save = () => {
    if (!editor) return;
    run(
      () => saveUserAction(editor),
      editor.id ? "Changes saved." : "User added.",
      () => setEditor(null),
    );
  };

  const confirmAction = () => {
    if (!confirm) return;
    const { kind, user } = confirm;
    run(
      () => (kind === "remove" ? removeUserAction(user.id) : setUserActiveAction(user.id, false)),
      kind === "remove" ? "User removed." : "User deactivated.",
      () => setConfirm(null),
    );
  };

  const reactivate = (u: UserRow) =>
    run(() => setUserActiveAction(u.id, true), "User reactivated.", () => {});

  const isSelfEditing = editor?.id === currentUserId;

  const rowActions = (u: UserRow, isSelf: boolean) => (
    <>
      <button
        type="button"
        onClick={() => openEdit(u)}
        className="flex h-9 items-center gap-1 rounded-lg bg-fill px-3 text-[15px] font-medium transition hover:opacity-80 active:opacity-70"
      >
        <Pencil className="size-4" aria-hidden />
        Edit
      </button>
      {!isSelf &&
        (u.isActive ? (
          <button
            type="button"
            onClick={() => setConfirm({ kind: "deactivate", user: u })}
            className="h-9 rounded-lg bg-fill px-3 text-[15px] font-medium transition hover:opacity-80 active:opacity-70"
          >
            Deactivate
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => reactivate(u)}
            className="h-9 rounded-lg bg-fill px-3 text-[15px] font-medium transition hover:opacity-80 active:opacity-70 disabled:opacity-50"
          >
            Reactivate
          </button>
        ))}
      {!isSelf && (
        <button
          type="button"
          onClick={() => setConfirm({ kind: "remove", user: u })}
          className="h-9 rounded-lg px-3 text-[15px] font-medium text-red-600 transition hover:opacity-80 active:opacity-70"
        >
          Remove
        </button>
      )}
    </>
  );

  return (
    <div className="flex animate-ios-in flex-col gap-5">
      <section aria-label="Summary" className="grid grid-cols-3 gap-2 md:gap-3">
        <Stat label="Total" value={total} />
        <Stat label="Active" value={active} />
        <Stat label="Inactive" value={total - active} />
      </section>

      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-label2" aria-hidden />
          <label htmlFor="user-search" className="sr-only">Search users</label>
          <input
            id="user-search"
            type="search"
            placeholder="Search name or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={`${fieldClass} pl-11`}
          />
        </div>
        <div className="flex gap-2">
          <label htmlFor="status-filter" className="sr-only">Filter by status</label>
          <select
            id="status-filter"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className={`${fieldClass} md:w-36`}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <label htmlFor="role-filter" className="sr-only">Filter by role</label>
          <select
            id="role-filter"
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
            className={`${fieldClass} md:w-32`}
          >
            <option value="all">All roles</option>
            <option value="owner">Owners</option>
            <option value="admin">Admins</option>
            <option value="staff">Staff</option>
          </select>
          <button
            type="button"
            onClick={openAdd}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-brand px-4 text-[17px] font-semibold text-white transition active:scale-[0.98] active:opacity-80"
          >
            <Plus className="size-5" aria-hidden />
            Add
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-separator bg-card p-6 text-center text-[15px] text-label2 shadow-sm">
          No users match your filters.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-separator bg-card shadow-sm lg:hidden">
          {visible.map((u) => {
            const isSelf = u.id === currentUserId;
            return (
              <li key={u.id} className="flex flex-col gap-3 border-b border-separator p-4 last:border-b-0 md:flex-row md:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar user={u} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[17px] font-medium">
                      {u.name ?? u.email}
                      {isSelf && <span className="text-label2"> (you)</span>}
                    </p>
                    {u.name && <p className="truncate text-[15px] text-label2">{u.email}</p>}
                    <p className="text-[13px] text-label2">
                      Added {u.addedAt} · {u.lastLogin ? `Last login ${u.lastLogin}` : "Never signed in"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <Badge tone={u.role === "staff" ? "muted" : "brand"}>{ROLE_LABEL[u.role]}</Badge>
                  <Badge tone={u.isActive ? "brand" : "muted"}>{u.isActive ? "Active" : "Inactive"}</Badge>
                  {rowActions(u, isSelf)}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {visible.length > 0 && (
        <div className="hidden overflow-hidden rounded-xl border border-separator bg-card shadow-sm lg:block">
          <table className="w-full text-left text-[15px]">
            <thead className="border-b border-separator text-[13px] text-label2">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">User</th>
                <th scope="col" className="px-4 py-3 font-medium">Role</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">Added</th>
                <th scope="col" className="px-4 py-3 font-medium">Last login</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <tr key={u.id} className="border-b border-separator last:border-b-0">
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar user={u} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {u.name ?? u.email}
                            {isSelf && <span className="text-label2"> (you)</span>}
                          </p>
                          {u.name && <p className="truncate text-[13px] text-label2">{u.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={u.role === "staff" ? "muted" : "brand"}>{ROLE_LABEL[u.role]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={u.isActive ? "brand" : "muted"}>{u.isActive ? "Active" : "Inactive"}</Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-label2">{u.addedAt}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-label2">{u.lastLogin ?? "Never signed in"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">{rowActions(u, isSelf)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editor && (
        <SheetModal title={editor.id ? "Edit user" : "Add user"} dismissible={!pending} onClose={() => setEditor(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            className="flex flex-col gap-4"
          >
            {dialogError && <ErrorNote>{dialogError}</ErrorNote>}
            <Field label="Google email" htmlFor="u-email">
              <input
                id="u-email"
                type="email"
                required
                value={editor.email}
                onChange={(e) => setEditor({ ...editor, email: e.target.value })}
                className={fieldClass}
              />
            </Field>
            <Field label="Name" htmlFor="u-name">
              <input
                id="u-name"
                type="text"
                value={editor.name}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                className={fieldClass}
              />
            </Field>
            <Field label="Role" htmlFor="u-role">
              <select
                id="u-role"
                value={editor.role}
                disabled={isSelfEditing}
                onChange={(e) => setEditor({ ...editor, role: e.target.value as Editor["role"] })}
                className={`${fieldClass} disabled:opacity-60`}
              >
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
              </select>
            </Field>

            {editor.role !== "staff" ? (
              <p className="flex items-start gap-2 rounded-xl bg-brand-tint p-3 text-[15px] text-brand">
                <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
                {editor.role === "owner"
                  ? "Owners have full access to every module and to User Management."
                  : "Admins have full access to every module. User Management is for owners only."}
              </p>
            ) : isSelfEditing ? null : (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-[15px] font-medium">Module access</legend>
                <ul className="overflow-hidden rounded-xl border border-separator">
                  {modules.map((m) => {
                    const on = editor.modules.includes(m.key);
                    return (
                      <li key={m.key} className="border-b border-separator last:border-b-0">
                        <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-3.5">
                          <span className="text-[17px]">{m.name}</span>
                          <input
                            type="checkbox"
                            role="switch"
                            checked={on}
                            onChange={() =>
                              setEditor({
                                ...editor,
                                modules: on
                                  ? editor.modules.filter((k) => k !== m.key)
                                  : [...editor.modules, m.key],
                              })
                            }
                            className="peer sr-only"
                          />
                          <span
                            aria-hidden
                            className="relative h-8 w-[52px] shrink-0 rounded-full bg-fill transition-colors peer-checked:bg-green-500 peer-focus-visible:ring-2 peer-focus-visible:ring-brand after:absolute after:top-0.5 after:left-0.5 after:size-7 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
                          />
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-[13px] text-label2">
                  Staff can only open the modules switched on here. Changes apply immediately.
                </p>
              </fieldset>
            )}

            <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-separator px-3.5">
              <span className="text-[17px]">Active</span>
              <input
                type="checkbox"
                role="switch"
                checked={editor.isActive}
                disabled={isSelfEditing}
                onChange={(e) => setEditor({ ...editor, isActive: e.target.checked })}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className="relative h-8 w-[52px] shrink-0 rounded-full bg-fill transition-colors peer-checked:bg-green-500 peer-disabled:opacity-50 peer-focus-visible:ring-2 peer-focus-visible:ring-brand after:absolute after:top-0.5 after:left-0.5 after:size-7 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
              />
            </label>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setEditor(null)}
                disabled={pending}
                className="h-12 flex-1 rounded-xl bg-fill text-[17px] font-medium transition active:opacity-70 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="h-12 flex-1 rounded-xl bg-brand text-[17px] font-semibold text-white transition active:scale-[0.98] active:opacity-80 disabled:opacity-50"
              >
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </SheetModal>
      )}

      {confirm && (
        <SheetModal
          title={confirm.kind === "remove" ? "Remove user?" : "Deactivate user?"}
          dismissible={!pending} onClose={() => setConfirm(null)}
        >
          <div className="flex flex-col gap-4">
            {dialogError && <ErrorNote>{dialogError}</ErrorNote>}
            <p className="text-[15px] text-label2">
              {confirm.kind === "remove"
                ? `${confirm.user.name ?? confirm.user.email} will be permanently removed and lose all access. This can't be undone.`
                : `${confirm.user.name ?? confirm.user.email} will be signed out of access immediately. You can reactivate them later.`}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                disabled={pending}
                className="h-12 flex-1 rounded-xl bg-fill text-[17px] font-medium transition active:opacity-70 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAction}
                disabled={pending}
                className="h-12 flex-1 rounded-xl bg-red-600 text-[17px] font-semibold text-white transition active:scale-[0.98] active:opacity-80 disabled:opacity-50"
              >
                {pending ? "Working…" : confirm.kind === "remove" ? "Remove" : "Deactivate"}
              </button>
            </div>
          </div>
        </SheetModal>
      )}

      {toast && (
        <div
          role="status"
          className={`fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-sm items-center gap-2 rounded-xl px-4 py-3 text-[15px] font-medium text-white shadow-lg lg:bottom-6 ${
            toast.ok ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {toast.ok ? <Check className="size-5 shrink-0" aria-hidden /> : <TriangleAlert className="size-5 shrink-0" aria-hidden />}
          {toast.text}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-separator bg-card p-3 shadow-sm md:p-4">
      <p className="text-[28px] leading-8 font-bold tracking-tight tabular-nums">{value}</p>
      <p className="text-[15px] text-label2">{label}</p>
    </div>
  );
}

function Badge({ tone, children }: { tone: "brand" | "muted"; children: ReactNode }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[13px] font-medium ${
        tone === "brand" ? "bg-brand-tint text-brand" : "bg-fill text-label2"
      }`}
    >
      {children}
    </span>
  );
}

function Avatar({ user }: { user: UserRow }) {
  if (user.avatarUrl) {
    return (
      <Image
        src={user.avatarUrl}
        alt=""
        width={44}
        height={44}
        unoptimized
        referrerPolicy="no-referrer"
        className="size-11 shrink-0 rounded-full"
      />
    );
  }
  return (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-[17px] font-semibold text-white">
      {(user.name ?? user.email).charAt(0).toUpperCase()}
    </span>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[15px] font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl bg-red-600/10 p-3 text-[15px] text-red-600">
      <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
      {children}
    </div>
  );
}
