"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Check, Pencil, TriangleAlert, X } from "lucide-react";
import { SheetModal } from "../../_components/sheet-modal";

type Result = { ok: true } | { ok: false; error: string };

type CategoryRow = { id: string; name: string; isActive: boolean; /** Optional secondary label, e.g. an expense type. */ tag?: string };

const fieldClass =
  "h-11 w-full min-w-0 rounded-xl border border-separator bg-card px-3.5 text-[17px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/25";

/** Shared add / rename / archive dialog for user-managed categories (ingredients and products). */
export function CategoriesDialog({
  categories,
  noun,
  pending,
  error,
  run,
  actions,
  typeOptions,
  onClose,
}: {
  categories: CategoryRow[];
  /** What the categories group, e.g. "ingredients": used in the helper text. */
  noun: string;
  pending: boolean;
  error: string | null;
  run: (work: () => Promise<Result>, success: string, onOk: () => void) => void;
  actions: {
    create: (name: string, type?: string) => Promise<Result>;
    rename: (id: string, name: string) => Promise<Result>;
    setActive: (id: string, active: boolean) => Promise<Result>;
  };
  /** When given, new categories pick one of these types and it is passed to `actions.create`. */
  typeOptions?: { value: string; label: string }[];
  onClose: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState(typeOptions?.[0]?.value);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  return (
    <SheetModal title="Categories" dismissible={!pending} onClose={() => onClose()}>
      <div className="flex flex-col gap-4">
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-xl bg-red-600/10 p-3 text-[15px] text-red-600">
            <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
            {error}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => actions.create(newName, newType), "Category added.", () => setNewName(""));
          }}
          className="flex flex-wrap gap-2"
        >
          <label htmlFor="c-new" className="sr-only">New category name</label>
          <input
            id="c-new"
            type="text"
            maxLength={60}
            placeholder="New category"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className={fieldClass}
          />
          {typeOptions && (
            <>
              <label htmlFor="c-type" className="sr-only">Category type</label>
              <select
                id="c-type"
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className={`${fieldClass} flex-1`}
              >
                {typeOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </>
          )}
          <button
            type="submit"
            disabled={pending || !newName.trim()}
            className="h-11 shrink-0 rounded-xl bg-brand px-4 text-[17px] font-semibold text-white transition active:opacity-80 disabled:opacity-50"
          >
            Add
          </button>
        </form>

        <ul className="overflow-hidden rounded-xl border border-separator">
          {categories.map((c) => (
            <li key={c.id} className="flex min-h-12 items-center gap-2 border-b border-separator px-3.5 py-2 last:border-b-0">
              {editingId === c.id ? (
                <form
                  className="flex min-w-0 flex-1 gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(() => actions.rename(c.id, draft), "Category renamed.", () => setEditingId(null));
                  }}
                >
                  <label htmlFor={`c-${c.id}`} className="sr-only">Category name</label>
                  <input
                    id={`c-${c.id}`}
                    autoFocus
                    type="text"
                    maxLength={60}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className={`${fieldClass} h-9`}
                  />
                  <button type="submit" disabled={pending} aria-label="Save name" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand text-white disabled:opacity-50">
                    <Check className="size-4" aria-hidden />
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} aria-label="Cancel rename" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-fill">
                    <X className="size-4" aria-hidden />
                  </button>
                </form>
              ) : (
                <>
                  <span className={`min-w-0 flex-1 truncate text-[17px] ${c.isActive ? "" : "text-label2"}`}>
                    {c.name}
                    {!c.isActive && " (archived)"}
                  </span>
                  {c.tag && <span className="shrink-0 rounded-full bg-fill px-2.5 py-0.5 text-[13px] text-label2">{c.tag}</span>}
                  <button
                    type="button"
                    aria-label={`Rename ${c.name}`}
                    onClick={() => {
                      setEditingId(c.id);
                      setDraft(c.name);
                    }}
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-fill transition active:opacity-70"
                  >
                    <Pencil className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    aria-label={c.isActive ? `Archive ${c.name}` : `Restore ${c.name}`}
                    onClick={() =>
                      run(
                        () => actions.setActive(c.id, !c.isActive),
                        c.isActive ? "Category archived." : "Category restored.",
                        () => {},
                      )
                    }
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-fill transition active:opacity-70 disabled:opacity-50"
                  >
                    {c.isActive ? <Archive className="size-4" aria-hidden /> : <ArchiveRestore className="size-4" aria-hidden />}
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
        <p className="text-[13px] text-label2">
          Archived categories can&apos;t be chosen for new {noun}; existing {noun} keep theirs.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="h-12 rounded-xl bg-fill text-[17px] font-medium transition active:opacity-70"
        >
          Done
        </button>
      </div>
    </SheetModal>
  );
}
