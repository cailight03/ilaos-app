import { Suspense } from "react";
import { TriangleAlert } from "lucide-react";
import { PageMain } from "../../_components/page-main";
import { PageHeader } from "../../_components/page-header";
import { requireModule } from "@/src/lib/session";
import { listCategories, listIngredients } from "@/src/lib/ingredients";
import { IngredientsManager } from "./ingredients-manager";
import { SectionTabs } from "../_components/section-tabs";

export default function IngredientsPage() {
  return (
    <PageMain>
      <Suspense fallback={<IngredientsSkeleton />}>
        <Content />
      </Suspense>
    </PageMain>
  );
}

async function Content() {
  await requireModule("costing_expenses");

  let data;
  try {
    const [ingredients, categories] = await Promise.all([listIngredients(), listCategories()]);
    data = { ingredients, categories };
  } catch (err) {
    console.error("[ingredients]", err);
    return (
      <>
        <PageHeader title="Costing & Expenses" subtitle="Ingredient Library" />
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-separator bg-card p-4 text-[15px] text-red-600 shadow-sm">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          Couldn&apos;t load ingredients. Check that supabase/costing-ingredients.sql has been run.
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Costing & Expenses" subtitle="Ingredient Library" />
      <SectionTabs />
      <IngredientsManager ingredients={data.ingredients} categories={data.categories} />
    </>
  );
}

function IngredientsSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5 pt-2" aria-busy aria-label="Loading ingredients">
      <div className="h-14 w-56 rounded-xl bg-fill" />
      <div className="grid grid-cols-3 gap-2">
        <div className="h-20 rounded-xl bg-fill" />
        <div className="h-20 rounded-xl bg-fill" />
        <div className="h-20 rounded-xl bg-fill" />
      </div>
      <div className="h-11 rounded-xl bg-fill" />
      <div className="h-64 rounded-xl bg-fill" />
    </div>
  );
}
