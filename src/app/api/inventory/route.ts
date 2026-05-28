// src/app/api/inventory/route.ts
import { NextRequest, NextResponse } from "next/server";
import { shopifySaree } from "@/lib/shopify";

// GET: Return all saree products (no pagination for simplicity)
export async function GET(req: NextRequest) {
  try {
    // Fetch all products; using a high limit (e.g., 250) and iterating if needed
    const allProducts: any[] = [];
    let cursor: string | null = null;
    do {
      const { products, nextCursor } = await shopifySaree.list(250, cursor);
      allProducts.push(...products);
      cursor = nextCursor;
    } while (cursor);
    return NextResponse.json({ products: allProducts });
  } catch (err: any) {
    console.error("Inventory API GET failure:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch inventory" }, { status: 500 });
  }
}
