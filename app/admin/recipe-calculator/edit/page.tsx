import { PageMain } from "../../_components/page-main";
import { PageHeader } from "../../_components/page-header";
import { requireModule } from "@/src/lib/session";
import { listIngredients } from "@/src/lib/ingredients";
import { loadEditableRecipes } from "@/src/lib/recipes-db";
import { RecipeEditor } from "./recipe-editor";

export default function EditRecipesPage() {
  return (
    <PageMain>
      <PageHeader title="Edit recipes" subtitle="Grams per piece" />
      <Content />
    </PageMain>
  );
}

async function Content() {
  await requireModule("recipe_calculator");
  const [recipes, ingredients] = await Promise.all([loadEditableRecipes(), listIngredients()]);
  // Names and ids only: the recipe module must not expose library prices.
  const library = ingredients
    .filter((i) => i.isActive && i.baseUnit !== "pcs")
    .map((i) => ({ id: i.id, name: i.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return <RecipeEditor recipes={recipes} library={library} />;
}
