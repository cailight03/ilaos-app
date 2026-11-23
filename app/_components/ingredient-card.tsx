import { cardDetail, cardTitle, formatGrams, type RecipeCard } from "@/src/lib/recipe-calc";

export function IngredientCard({ card }: { card: RecipeCard }) {
  const detail = cardDetail(card);
  return (
    <section>
      <div className="mb-1.5 px-4">
        <h3 className="text-[13px] font-semibold text-label2">{cardTitle(card)}</h3>
        {detail && <p className="text-[13px] text-label2">{detail}</p>}
      </div>
      <div className="overflow-hidden rounded-xl border border-separator bg-card shadow-sm">
        {card.ingredients.length === 0 ? (
          <p className="px-4 py-4 text-[15px] text-label2">Recipe not added yet.</p>
        ) : (
          <table className="w-full text-[17px]">
            <thead className="sr-only">
              <tr>
                <th>Ingredient</th>
                <th>Quantity</th>
              </tr>
            </thead>
            <tbody>
              {card.ingredients.map((i) => (
                <tr key={i.name} className="border-b border-separator last:border-b-0">
                  <td className="py-3 pl-4">{i.name}</td>
                  <td className="py-3 pr-4 text-right font-semibold text-label2 tabular-nums">
                    {formatGrams(i.grams)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
