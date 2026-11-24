import { Suspense } from "react";
import { TriangleAlert } from "lucide-react";
import { PageMain } from "../../_components/page-main";
import { PageHeader } from "../../_components/page-header";
import { SectionTabs } from "../_components/section-tabs";
import { requireModule } from "@/src/lib/session";
import { loadProductCosts } from "@/src/lib/product-costing";
import { ProductsOverview } from "./products-overview";

export default function ProductCostingPage() {
  return (
    <PageMain>
      <Suspense fallback={<ProductsSkeleton />}>
        <Content />
      </Suspense>
    </PageMain>
  );
}

async function Content() {
  await requireModule("costing_expenses");

  let data;
  try {
    data = await loadProductCosts();
  } catch (err) {
    console.error("[product-costing]", err);
    return (
      <>
        <PageHeader title="Costing & Expenses" subtitle="Product Costing" />
        <SectionTabs />
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-separator bg-card p-4 text-[15px] text-red-600 shadow-sm">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          Couldn&apos;t load product costs. Check that supabase/product-costing.sql and supabase/product-catalog.sql have been run.
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Costing & Expenses" subtitle="Product Costing" />
      <SectionTabs />
      <ProductsOverview products={data.products} categories={data.categories} />
    </>
  );
}

function ProductsSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5 pt-2" aria-busy aria-label="Loading product costs">
      <div className="h-14 w-56 rounded-xl bg-fill" />
      <div className="h-10 rounded-xl bg-fill" />
      <div className="grid grid-cols-3 gap-2">
        <div className="h-20 rounded-xl bg-fill" />
        <div className="h-20 rounded-xl bg-fill" />
        <div className="h-20 rounded-xl bg-fill" />
      </div>
      <div className="h-64 rounded-xl bg-fill" />
    </div>
  );
}
