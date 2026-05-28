import { shopifySaree } from "@/lib/shopify";
import { sareeDb } from "@/lib/db";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import InventoryGrid from "@/components/products/InventoryGrid";

export const revalidate = 0; // Dynamic server component

export default async function ProductsPage() {
  let products: any[] = [];

  try {
    // 1. Fetch products from Shopify
    const listRes = await shopifySaree.list(200);
    products = listRes.products;

    // 2. Fetch corresponding metadata from Redis
    const skus = products.map(p => p.sku).filter(Boolean);
    const metaMap = await sareeDb.mget(skus);

    // 3. Merge cost prices into products
    products = products.map(p => {
      const meta = metaMap[p.sku];
      return {
        ...p,
        costPrice: meta?.costPrice || 0,
        margin: meta?.margin || 0,
        privateNotes: meta?.privateNotes || ""
      };
    });

  } catch (error) {
    console.error("Failed to fetch products for grid:", error);
  }

  return (
    <div className="flex min-h-screen bg-[#FAF8F5]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Saree Inventory Grid" />
        
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 max-w-[1360px] mx-auto w-full">
          <InventoryGrid initialProducts={products} />
        </main>
      </div>
    </div>
  );
}
