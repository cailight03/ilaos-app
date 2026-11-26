import Link from "next/link";
import { Suspense } from "react";
import { PageMain } from "../_components/page-main";
import { PageHeader } from "../_components/page-header";
import { requireModule } from "@/src/lib/session";
import { getSheetRows } from "@/src/lib/google-sheets";
import { parseOrders } from "@/src/lib/orders";
import { loadRecipes } from "@/src/lib/recipes-db";
import { RecipeCalculator } from "./recipe-calculator";

export default function RecipeCalculatorPage({ searchParams }: PageProps<"/admin/recipe-calculator">) {
  return (
    <>
      <PageMain>
        <PageHeader title="Recipes" subtitle="Recipe calculator" />
        <Suspense fallback={<RecipeSkeleton />}>
          <Content searchParams={searchParams} />
        </Suspense>
      </PageMain>
    </>
  );
}

async function Content({
  searchParams,
}: {
  searchParams: PageProps<"/admin/recipe-calculator">["searchParams"];
}) {
  await requireModule("recipe_calculator");
  const { bakeDate } = await searchParams;
  let initial =
    typeof bakeDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(bakeDate) ? bakeDate : "";

  // No date in the URL: default to the most recent bake date, if the sheet can be read.
  if (!initial) {
    try {
      const { rows } = await getSheetRows();
      initial = parseOrders(rows).reduce(
        (latest, o) => (o.bakeDate && o.bakeDate > latest ? o.bakeDate : latest),
        "",
      );
    } catch {
      // Leave the date empty; the user can still pick one.
    }
  }
  const recipes = await loadRecipes({ activeOnly: true });
  return (
    <>
      <Link href="/admin/recipe-calculator/edit" className="self-start text-[15px] text-brand">
        Edit recipes
      </Link>
      <RecipeCalculator recipes={recipes} initialBakeDate={initial} />
    </>
  );
}

function RecipeSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5" aria-busy aria-label="Loading">
      <div className="h-32 rounded-xl bg-fill" />
      <div className="h-72 rounded-xl bg-fill" />
    </div>
  );
}
