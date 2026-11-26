import { Suspense } from "react";
import { PageMain } from "../../_components/page-main";
import { PageHeader } from "../../_components/page-header";
import { SectionTabs } from "../_components/section-tabs";
import { requireModule } from "@/src/lib/session";
import { listCatalog } from "@/src/lib/catalog";
import { listProductCategories } from "@/src/lib/product-costing";
import { CatalogManager } from "./catalog-manager";

export default function CatalogPage() {
  return (
    <PageMain>
      <PageHeader title="Costing & Expenses" subtitle="Catalog" />
      <SectionTabs />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-fill" aria-busy aria-label="Loading" />}>
        <Content />
      </Suspense>
    </PageMain>
  );
}

async function Content() {
  await requireModule("costing_expenses");
  const [products, categories] = await Promise.all([listCatalog(), listProductCategories()]);
  return <CatalogManager products={products} categories={categories.filter((c) => c.isActive)} />;
}
