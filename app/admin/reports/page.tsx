import { Suspense } from "react";
import { PageMain } from "../_components/page-main";
import { TriangleAlert } from "lucide-react";
import { SheetsError } from "@/src/lib/google-sheets";
import { fetchReportOrders } from "@/src/lib/reports-service";
import { todayInManila, type ReportOrder } from "@/src/lib/sales-report";
import { requireModule } from "@/src/lib/session";
import { RefreshButton } from "../_components/controls";
import { PageHeader } from "../_components/page-header";
import { ReportsView } from "./reports-view";

export default function ReportsPage() {
  return (
    <>
      <PageMain>
        <Suspense fallback={<ReportsSkeleton />}>
          <Content />
        </Suspense>
      </PageMain>
    </>
  );
}

async function Content() {
  await requireModule("sales_reports");

  let orders: ReportOrder[];
  try {
    orders = await fetchReportOrders();
  } catch (err) {
    const message =
      err instanceof SheetsError ? err.message : "Something went wrong loading sales data.";
    return (
      <>
        <PageHeader title="Sales Report" subtitle="Ilao's Microbakery" />
        <div role="alert" className="rounded-xl border border-separator bg-card p-4 shadow-sm">
          <div className="flex items-start gap-2 text-[15px] text-red-600">
            <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
            {message}
          </div>
          <div className="mt-4">
            <RefreshButton variant="solid" />
          </div>
        </div>
      </>
    );
  }

  return <ReportsView orders={orders} today={todayInManila()} />;
}

function ReportsSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5 pt-2" aria-busy aria-label="Loading sales report">
      <div className="h-14 w-48 rounded-xl bg-fill" />
      <div className="h-9 rounded-full bg-fill" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-[116px] rounded-xl bg-fill" />
        ))}
      </div>
      <div className="h-72 rounded-xl bg-fill" />
      <div className="h-64 rounded-xl bg-fill" />
    </div>
  );
}
