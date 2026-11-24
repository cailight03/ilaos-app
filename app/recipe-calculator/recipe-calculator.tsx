"use client";

import { useMemo, useState, useTransition } from "react";
import { Copy, Download, RotateCcw } from "lucide-react";
import {
  buildRecipeCards,
  emptyQuantities,
  formatRecipeText,
  totalPieces,
} from "@/src/lib/recipe-calc";
import { RECIPES, type Quantities, type RecipeId } from "@/src/lib/recipes";
import { DatePicker } from "@/app/_components/date-picker";
import { IngredientCard } from "@/app/_components/ingredient-card";
import { QuantityInput } from "@/app/_components/quantity-input";
import { totalStarterGrams } from "@/src/lib/starter-calc";
import { loadQuantitiesFromOrders } from "./actions";
import { StarterCalculator, type StarterRequest } from "./starter-calculator";

type Notice = { kind: "error" | "success"; text: string } | null;

export function RecipeCalculator({ initialBakeDate }: { initialBakeDate: string }) {
  const [quantities, setQuantities] = useState<Quantities>(emptyQuantities);
  const [bakeDate, setBakeDate] = useState(initialBakeDate);
  const [notice, setNotice] = useState<Notice>(null);
  const [loading, startLoad] = useTransition();

  const cards = useMemo(() => buildRecipeCards(quantities), [quantities]);
  const total = totalPieces(quantities);
  const [starterRequest, setStarterRequest] = useState<StarterRequest | null>(null);
  const starterNeeded = useMemo(() => totalStarterGrams(cards), [cards]);

  function calculateStarterBuild() {
    setStarterRequest((r) => ({ grams: starterNeeded, nonce: (r?.nonce ?? 0) + 1 }));
    document.getElementById("starter-calculator")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setQuantity(id: RecipeId, value: number) {
    setQuantities((q) => ({ ...q, [id]: value }));
  }

  function loadOrders() {
    setNotice(null);
    startLoad(async () => {
      try {
        const res = await loadQuantitiesFromOrders(bakeDate);
        if (!res.ok) {
          setNotice({ kind: "error", text: res.error }); // keeps existing quantities
          return;
        }
        setQuantities(res.quantities);
        setNotice({
          kind: "success",
          text: `Loaded ${res.orderCount} order${res.orderCount === 1 ? "" : "s"}. You can still adjust quantities.`,
        });
      } catch {
        setNotice({ kind: "error", text: "Could not load orders. Check your connection." });
      }
    });
  }

  async function copyRecipe() {
    try {
      await navigator.clipboard.writeText(formatRecipeText(cards));
      setNotice({ kind: "success", text: "Recipe copied to clipboard." });
    } catch {
      setNotice({ kind: "error", text: "Couldn't copy. Please try again." });
    }
  }

  const secondary =
    "flex h-11 items-center justify-center gap-2 rounded-xl bg-card text-[17px] font-medium text-brand shadow-sm ring-1 ring-separator transition active:scale-[0.97] active:opacity-70 disabled:text-label2/50 disabled:active:scale-100";

  return (
    <div className="flex animate-ios-in flex-col gap-5">
      <section aria-label="Load from orders" className="flex flex-col gap-3">
        <DatePicker label="Bake date" value={bakeDate} onChange={setBakeDate} />
        <button
          type="button"
          onClick={loadOrders}
          disabled={loading || !bakeDate}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-brand text-[17px] font-semibold text-white transition active:scale-[0.98] active:opacity-80 disabled:opacity-50 disabled:active:scale-100"
        >
          <Download className={`size-5 ${loading ? "animate-pulse" : ""}`} aria-hidden />
          {loading ? "Loading orders…" : "Load from orders"}
        </button>
      </section>

      <section aria-labelledby="qty-heading">
        <div className="mb-1.5 flex items-baseline justify-between px-4">
          <h2 id="qty-heading" className="text-[13px] text-label2">
            Quantities
          </h2>
          <span className="text-[13px] text-label2 tabular-nums" aria-live="polite">
            {total.toLocaleString()} total to bake
          </span>
        </div>
        <div className="divide-y divide-separator rounded-xl border border-separator bg-card px-4 shadow-sm">
          {RECIPES.map((r) => (
            <QuantityInput
              key={r.id}
              id={`qty-${r.id}`}
              label={r.label}
              value={quantities[r.id]}
              onChange={(v) => setQuantity(r.id, v)}
            />
          ))}
        </div>
      </section>

      {notice && (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          className={`rounded-xl border p-3.5 text-[15px] ${
            notice.kind === "error"
              ? "border-red-500/30 bg-red-500/10 text-red-600"
              : "border-green-500/30 bg-green-500/10 text-green-700"
          }`}
        >
          {notice.text}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          className={secondary}
          disabled={total === 0}
          onClick={() => {
            setQuantities(emptyQuantities());
            setNotice(null);
          }}
        >
          <RotateCcw className="size-[18px]" aria-hidden />
          Reset
        </button>
        <button type="button" className={secondary} disabled={total === 0} onClick={copyRecipe}>
          <Copy className="size-[18px]" aria-hidden />
          Copy recipe
        </button>
      </div>

      {cards.map((card) => (
        <IngredientCard key={card.id} card={card} />
      ))}

      <button
        type="button"
        onClick={calculateStarterBuild}
        disabled={starterNeeded <= 0}
        className="flex h-12 items-center justify-center gap-2 rounded-xl bg-brand text-[17px] font-semibold text-white transition active:scale-[0.98] active:opacity-80 disabled:opacity-50 disabled:active:scale-100"
      >
        Calculate Starter Build
      </button>

      <StarterCalculator request={starterRequest} />
    </div>
  );
}
