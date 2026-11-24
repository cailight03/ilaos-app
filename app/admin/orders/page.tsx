import { Suspense } from "react";
import { PageMain } from "../_components/page-main";
import { SheetsError } from "@/src/lib/google-sheets";
import { fetchOrders } from "@/src/lib/orders-service";
import { requireModule } from "@/src/lib/session";
import type { Order } from "@/src/lib/orders";
import { bakeDatesOf } from "@/src/lib/order-view";
import { OrdersView } from "./orders-view";

export default function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  return (
    <>
      <PageMain>
        <Suspense fallback={<OrdersSkeleton />}>
          <Content searchParams={searchParams} />
        </Suspense>
      </PageMain>
    </>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/admin/orders">["searchParams"] }) {
  await requireModule("orders");

  const { bakeDate } = await searchParams;
  const requested =
    typeof bakeDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(bakeDate) ? bakeDate : "";

  let orders: Order[] = [];
  let syncedAt: string | null = null;
  let error: string | null = null;
  try {
    orders = await fetchOrders();
    syncedAt = new Date().toISOString();
  } catch (err) {
    error = err instanceof SheetsError ? err.message : "Something went wrong loading orders.";
  }

  // No date in the URL means the most recent bake day; "all" opts out.
  const initialBakeDate = requested || (bakeDate === "all" ? "" : (bakeDatesOf(orders).at(-1) ?? ""));

  return (
    <OrdersView
      initialOrders={orders}
      initialSyncedAt={syncedAt}
      initialError={error}
      initialBakeDate={initialBakeDate}
    />
  );
}

function OrdersSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5 pt-2" aria-busy aria-label="Loading orders">
      <div className="h-14 w-40 rounded-xl bg-fill" />
      <div className="grid grid-cols-3 gap-2">
        <div className="h-20 rounded-xl bg-fill" />
        <div className="h-20 rounded-xl bg-fill" />
        <div className="h-20 rounded-xl bg-fill" />
      </div>
      <div className="h-10 rounded-[10px] bg-fill" />
      <div className="h-40 rounded-xl bg-fill" />
      <div className="h-48 rounded-xl bg-fill" />
    </div>
  );
}
