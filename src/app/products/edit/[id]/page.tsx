import { shopifySaree } from "@/lib/shopify";
import { sareeDb } from "@/lib/db";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import EditProductForm from "@/components/products/EditProductForm";
import { notFound } from "next/navigation";

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export const revalidate = 0; // Dynamic server component

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;
  const shopifyId = `gid://shopify/Product/${id}`;

  // 1. Fetch from Shopify
  const product = await shopifySaree.get(shopifyId);
  if (!product) {
    notFound();
  }

  // 2. Fetch cost price metadata from Redis
  let costPrice = 0;
  let privateNotes = "";
  if (product.sku) {
    const meta = await sareeDb.get(product.sku);
    if (meta) {
      costPrice = meta.costPrice;
      privateNotes = meta.privateNotes || "";
    }
  }

  const mergedProduct = {
    ...product,
    costPrice,
    privateNotes
  };

  return (
    <div className="flex min-h-screen bg-[#FAF8F5]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={`Edit Saree: ${product.sku}`} />
        
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 max-w-[1000px] mx-auto w-full">
          <EditProductForm initialProduct={mergedProduct} />
        </main>
      </div>
    </div>
  );
}
