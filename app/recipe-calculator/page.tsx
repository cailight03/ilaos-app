import { Suspense } from "react";
import { redirect } from "next/navigation";
import { BottomNav } from "../_components/bottom-nav";
import { PageHeader } from "../_components/page-header";
import { hasSession } from "@/src/lib/session";
import { getSheetRows } from "@/src/lib/google-sheets";
import { parseOrders } from "@/src/lib/orders";
import { RecipeCalculator } from "./recipe-calculator";

export default function RecipeCalculatorPage({ searchParams }: PageProps<"/recipe-calculator">) {
  return (
    <>
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(5rem+env(safe-area-inset-bottom))]">
        <PageHeader title="Recipes" subtitle="Recipe calculator" />
        <Suspense fallback={<RecipeSkeleton />}>
          <Content searchParams={searchParams} />
        </Suspense>
      </main>
      <BottomNav />
    </>
  );
}

async function Content({
  searchParams,
}: {
  searchParams: PageProps<"/recipe-calculator">["searchParams"];
}) {
  if (!(await hasSession())) redirect("/login");
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
  return <RecipeCalculator initialBakeDate={initial} />;
}

function RecipeSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5" aria-busy aria-label="Loading">
      <div className="h-32 rounded-xl bg-fill" />
      <div className="h-72 rounded-xl bg-fill" />
    </div>
  );
}
