import { NextRequest, NextResponse } from "next/server";
import { shopifyAdminFetch, shopifyCollection } from "@/lib/shopify";
import { cookies } from "next/headers";

async function verifySession() {
  const cookieStore = await cookies();
  const session = cookieStore.get("crm_session");
  return session && session.value === "authenticated";
}

export async function POST(req: NextRequest) {
  try {
    if (!await verifySession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { tag, collectionId } = await req.json();
    
    if (!tag || !collectionId) return NextResponse.json({ error: "Tag and Collection ID are required" }, { status: 400 });

    const lowerTag = tag.toLowerCase();
    if (lowerTag === "all sarees" || lowerTag.includes("founder")) {
      return NextResponse.json({ error: "Cannot delete this protected collection" }, { status: 400 });
    }

    console.log(`⏳ Initiating deletion of collection ${tag} and removing tag from all products...`);

    // 1. Fetch all products that have this tag
    const query = `
      query getProductsByTag($query: String!) {
        products(first: 250, query: $query) {
          edges {
            node {
              id
              tags
            }
          }
        }
      }
    `;
    const res = await shopifyAdminFetch<{ products: { edges: Array<{ node: { id: string, tags: string[] } }> } }>({
      query,
      variables: { query: `tag:'${tag}'` }
    });

    const products = res.products.edges.map(e => e.node);

    // 2. Remove tag from each product
    const updateMutation = `
      mutation productUpdate($input: ProductInput!) {
        productUpdate(input: $input) {
          userErrors { message }
        }
      }
    `;

    for (const product of products) {
      const updatedTags = product.tags.filter(t => t.toLowerCase() !== lowerTag);
      await shopifyAdminFetch({
        query: updateMutation,
        variables: {
          input: {
            id: product.id,
            tags: updatedTags
          }
        }
      });
    }

    console.log(`✅ Removed tag ${tag} from ${products.length} products.`);

    // 3. Delete the collection
    const success = await shopifyCollection.delete(collectionId);
    if (!success) {
      return NextResponse.json({ error: "Failed to delete collection from Shopify" }, { status: 500 });
    }

    console.log(`✅ Deleted collection ${collectionId} from Shopify.`);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Collection delete error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
