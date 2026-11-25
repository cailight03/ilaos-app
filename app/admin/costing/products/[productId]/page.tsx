import { Suspense } from "react";
import { notFound } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { PageMain } from "../../../_components/page-main";
import { requireModule } from "@/src/lib/session";
import { loadProductCosts } from "@/src/lib/product-costing";
import { ProductDetail, type IngredientOption } from "./product-detail";

export default function ProductDetailPage({ params }: PageProps<"/admin/costing/products/[productId]">) {
  return (
    <PageMain>
      <Suspense fallback={<DetailSkeleton />}>
        <Content params={params} />
      </Suspense>
    </PageMain>
  );
}

async function Content({ params }: { params: PageProps<"/admin/costing/products/[productId]">["params"] }) {
  await requireModule("costing_expenses");
  const { productId: raw } = await params;
  const productId = decodeURIComponent(raw);

  let loaded;
  try {
    loaded = await loadProductCosts();
  } catch (err) {
    console.error("[product-costing]", err);
    return (
      <div role="alert" className="flex items-start gap-2 rounded-xl border border-separator bg-card p-4 text-[15px] text-red-600 shadow-sm">
        <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
        Couldn&apos;t load this product. Check that supabase/product-costing.sql and supabase/product-catalog.sql have been run.
      </div>
    );
  }
  const product = loaded.products.find((p) => p.productId === productId);
  if (!product) notFound();
  const data = { product, ingredients: loaded.ingredients, categories: loaded.categories };
  const options: IngredientOption[] = data.ingredients.map((i) => ({
    id: i.id,
    name: i.name,
    baseUnit: i.baseUnit,
    categoryName: i.categoryName,
    isActive: i.isActive,
  }));

  return <ProductDetail
      key={String(data.product.sellingPrice)}
      product={data.product}
      ingredients={options}
      categories={data.categories}
    />;
}

function DetailSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5 pt-2" aria-busy aria-label="Loading product">
      <div className="h-10 w-48 rounded-xl bg-fill" />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-20 rounded-xl bg-fill" />
        ))}
      </div>
      <div className="h-72 rounded-xl bg-fill" />
    </div>
  );
}

