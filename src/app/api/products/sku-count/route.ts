import { NextRequest, NextResponse } from "next/server";
import { shopifyAdminFetch } from "@/lib/shopify";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("crm_session");
    if (!session || session.value !== "authenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const region = searchParams.get("region") || "Banaras";

    // Query Shopify for products matching this region tag or vendor
    const query = `
      query countProducts($query: String!) {
        productsCount(query: $query) {
          count
        }
      }
    `;

    const data = await shopifyAdminFetch<{ productsCount: { count: number } }>({
      query,
      variables: {
        query: `vendor:'Reshami Pallu' AND tag:'Region:${region}'`
      }
    });

    return NextResponse.json({ count: data.productsCount?.count || 0 });
  } catch (err: any) {
    // If it fails or region is new, return a safe fallback default count
    return NextResponse.json({ count: 0 });
  }
}
