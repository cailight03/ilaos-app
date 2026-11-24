import { redirect } from "next/navigation";

// Ingredient Library is the first section of Costing & Expenses.
export default function CostingPage() {
  redirect("/admin/costing/ingredients");
}
