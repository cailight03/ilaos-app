import { Suspense } from "react";
import { TriangleAlert } from "lucide-react";
import { PageMain } from "../../_components/page-main";
import { PageHeader } from "../../_components/page-header";
import { requireModule } from "@/src/lib/session";
import { listExpenseCategories, listExpenses } from "@/src/lib/expenses";
import { SectionTabs } from "../_components/section-tabs";
import { ExpensesManager } from "./expenses-manager";

export default function ExpensesPage() {
  return (
    <PageMain>
      <Suspense fallback={<ExpensesSkeleton />}>
        <Content />
      </Suspense>
    </PageMain>
  );
}

async function Content() {
  await requireModule("costing_expenses");

  let data;
  try {
    const [expenses, categories] = await Promise.all([listExpenses(), listExpenseCategories()]);
    data = { expenses, categories };
  } catch (err) {
    console.error("[expenses]", err);
    return (
      <>
        <PageHeader title="Costing & Expenses" subtitle="Expenses" />
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-separator bg-card p-4 text-[15px] text-red-600 shadow-sm">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          Couldn&apos;t load expenses. Check that supabase/expenses.sql has been run.
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Costing & Expenses" subtitle="Expenses" />
      <SectionTabs />
      <ExpensesManager expenses={data.expenses} categories={data.categories} />
    </>
  );
}

function ExpensesSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5 pt-2" aria-busy aria-label="Loading expenses">
      <div className="h-14 w-56 rounded-xl bg-fill" />
      <div className="grid grid-cols-3 gap-2">
        <div className="h-24 rounded-xl bg-fill" />
        <div className="h-24 rounded-xl bg-fill" />
        <div className="h-24 rounded-xl bg-fill" />
      </div>
      <div className="h-11 rounded-xl bg-fill" />
      <div className="h-64 rounded-xl bg-fill" />
    </div>
  );
}
