"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ArrowUpDown, RefreshCw, Search, Wheat } from "lucide-react";
import type { Order } from "@/src/lib/orders";
import {
  DEFAULT_FILTERS,
  SORT_LABELS,
  bakeDatesOf,
  duplicateInvoiceIds,
  filterAndSortOrders,
  formatBakeDate,
  formatPeso,
  productLabel,
  summarizeOrders,
  type OrderFilters,
  type SortKey,
} from "@/src/lib/order-view";
import { knownProducts } from "@/src/lib/product-registry";
import { PageHeader } from "../_components/page-header";
import { SelectRow } from "../_components/select-row";
import { OrderCard } from "./order-card";
import { OrderDetailSheet } from "./order-detail-sheet";
import { OrdersTable } from "./orders-table";

const REFRESH_MS = 60_000;
const PAGE_SIZE = 30;

type Props = {
  initialOrders: Order[];
  initialSyncedAt: string | null;
  initialError: string | null;
  initialBakeDate: string;
};

export function OrdersView({ initialOrders, initialSyncedAt, initialError, initialBakeDate }: Props) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [syncedAt, setSyncedAt] = useState(initialSyncedAt);
  const [error, setError] = useState(initialError);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<OrderFilters>({ ...DEFAULT_FILTERS, bakeDate: initialBakeDate });
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<Order | null>(null);
  const lastSync = useRef(initialSyncedAt ? Date.parse(initialSyncedAt) : 0);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/orders/view", { cache: "no-store" });
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (res.status === 403) {
        router.push("/admin/access-denied");
        return;
      }
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to load orders");
      setOrders(body.orders);
      setSyncedAt(body.syncedAt);
      lastSync.current = Date.parse(body.syncedAt);
      setError(null);
    } catch (e) {
      // Keep showing the last good data; just flag that it may be stale.
      setError(e instanceof Error ? e.message : "Failed to load orders");
    } finally {
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const onVisible = () => {
      // iOS suspends timers in the background, so catch up when the app is reopened.
      if (document.visibilityState === "visible" && Date.now() - lastSync.current > REFRESH_MS) {
        refresh();
      }
    };
    const id = setInterval(tick, REFRESH_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const update = (patch: Partial<OrderFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setVisible(PAGE_SIZE);
  };

  const bakeDates = useMemo(() => bakeDatesOf(orders), [orders]);
  const duplicates = useMemo(() => new Set(duplicateInvoiceIds(orders)), [orders]);
  const shown = useMemo(() => filterAndSortOrders(orders, filters), [orders, filters]);
  const summary = useMemo(() => summarizeOrders(shown), [shown]);
  const archivedCount = useMemo(() => orders.filter((o) => o.archived).length, [orders]);

  const isFiltered =
    filters.query !== "" ||
    filters.bakeDate !== "" ||
    filters.product !== "" ||
    filters.sort !== "newest" ||
    filters.showArchived;

  const dateOptions = [
    { value: "", label: "All dates" },
    ...[...bakeDates].reverse().map((d) => ({ value: d, label: formatBakeDate(d) })),
  ];
  const productOptions = [
    { value: "", label: "All products" },
    ...knownProducts().map((k) => ({ value: k, label: productLabel(k) })),
  ];
  const sortOptions = (Object.keys(SORT_LABELS) as SortKey[]).map((k) => ({
    value: k,
    label: SORT_LABELS[k],
  }));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Orders" subtitle="Manage your bakery orders">
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          aria-label="Refresh orders"
          className="flex size-11 items-center justify-center rounded-full bg-card text-brand shadow-sm ring-1 ring-separator transition active:scale-90 active:opacity-70 disabled:opacity-60"
        >
          <RefreshCw className={`size-5 ${refreshing ? "animate-spin" : ""}`} aria-hidden />
        </button>
      </PageHeader>

      <p className="-mt-2 px-1 text-[13px] text-label2" aria-live="polite">
        {syncedAt ? (
          <>
            Last synced{" "}
            <time dateTime={syncedAt} suppressHydrationWarning>
              {new Date(syncedAt).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}
            </time>
          </>
        ) : (
          "Not synced yet"
        )}
      </p>

      {error && (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-[15px] text-red-600">
          {error}
          {orders.length > 0 && " Showing the last loaded data."}
        </div>
      )}

      <section className="grid grid-cols-3 gap-2" aria-label="Summary">
        <Stat label="Orders" value={String(summary.totalOrders)} />
        <Stat label="Items" value={String(summary.totalItems)} />
        <Stat label="Sales" value={formatPeso(summary.totalSales)} />
      </section>

      <div className="relative lg:max-w-md">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-[18px] -translate-y-1/2 text-label2"
          aria-hidden
        />
        <input
          type="search"
          value={filters.query}
          onChange={(e) => update({ query: e.target.value })}
          placeholder="Search customer or order ID"
          aria-label="Search orders"
          enterKeyHint="search"
          autoComplete="off"
          className="h-10 w-full rounded-[10px] bg-fill pr-3 pl-9 text-[17px] outline-none placeholder:text-label2 focus-visible:ring-2 focus-visible:ring-brand/40"
        />
      </div>

      <section aria-label="Filters">
        <div className="rounded-xl border border-separator bg-card shadow-sm lg:grid lg:grid-cols-3 lg:divide-x lg:divide-separator">
          <div className="group/row">
            <SelectRow
              label="Bake date"
              Icon={CalendarDays}
              value={filters.bakeDate}
              options={dateOptions}
              onChange={(v) => update({ bakeDate: v })}
            />
          </div>
          <div className="group/row">
            <SelectRow
              label="Product"
              Icon={Wheat}
              value={filters.product}
              options={productOptions}
              onChange={(v) => update({ product: v })}
            />
          </div>
          <div className="group/row">
            <SelectRow
              label="Sort by"
              Icon={ArrowUpDown}
              value={filters.sort}
              options={sortOptions}
              onChange={(v) => update({ sort: v as SortKey })}
            />
          </div>
        </div>
        <div className="mt-1 flex items-center justify-between px-1">
          <button
            type="button"
            aria-pressed={filters.showArchived}
            onClick={() => update({ showArchived: !filters.showArchived })}
            className="min-h-9 px-2 text-[15px] font-medium text-brand transition active:opacity-60"
          >
            {filters.showArchived ? "Hide archived" : `Show archived${archivedCount ? ` (${archivedCount})` : ""}`}
          </button>
          <button
            type="button"
            disabled={!isFiltered}
            onClick={() => update({ ...DEFAULT_FILTERS })}
            className="min-h-9 px-2 text-[15px] font-medium text-brand transition active:opacity-60 disabled:text-label2/50"
          >
            Reset filters
          </button>
        </div>
      </section>

      {shown.length === 0 ? (
        <p className="py-10 text-center text-[15px] text-label2">
          {orders.length === 0 ? "No orders yet." : "No orders match your filters."}
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-3 lg:hidden">
            {shown.slice(0, visible).map((o) => (
              <li key={o.rowNumber} className="animate-ios-in">
                <OrderCard order={o} duplicateId={duplicates.has(o.invoiceId)} onOpen={setSelected} />
              </li>
            ))}
          </ul>
          <OrdersTable orders={shown.slice(0, visible)} duplicates={duplicates} onOpen={setSelected} />
          {shown.length > visible && (
            <button
              type="button"
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="h-12 rounded-xl bg-card text-[17px] font-medium text-brand shadow-sm ring-1 ring-separator transition active:scale-[0.98] active:opacity-70"
            >
              Show more ({shown.length - visible} left)
            </button>
          )}
        </>
      )}

      <OrderDetailSheet
        order={selected}
        onClose={() => setSelected(null)}
        onPaidChange={(rowNumber, paid) => {
          setOrders((list) => list.map((o) => (o.rowNumber === rowNumber ? { ...o, paid } : o)));
          setSelected((s) => (s && s.rowNumber === rowNumber ? { ...s, paid } : s));
        }}
        onPatch={(rowNumber, patch) => {
          setOrders((list) => list.map((o) => (o.rowNumber === rowNumber ? { ...o, ...patch } : o)));
          setSelected((s) => (s && s.rowNumber === rowNumber ? { ...s, ...patch } : s));
        }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-separator bg-card p-3 shadow-sm">
      <p className="text-[13px] text-label2">{label}</p>
      <p className="mt-0.5 truncate text-[19px] font-bold tracking-tight tabular-nums">{value}</p>
    </div>
  );
}
