import { NextRequest, NextResponse } from "next/server";
import { shopifySaree } from "@/lib/shopify";
import { sareeDb, db } from "@/lib/db";
import { cookies } from "next/headers";

// Authentication Helper
async function verifySession() {
  const cookieStore = await cookies();
  const session = cookieStore.get("crm_session");
  return session && session.value === "authenticated";
}

// Helper to poll Redis and wait for async media queue conversion to finish
async function resolveQueuedMedia(mediaReference: { id: string, url: string }) {
  if (!mediaReference || !mediaReference.id || !mediaReference.id.startsWith("media_")) {
    return mediaReference;
  }

  const mediaId = mediaReference.id;
  console.log(`[Products API] Resolving queued media reference: ${mediaId}...`);

  // Poll Redis for up to 40 attempts (20 seconds)
  for (let attempt = 0; attempt < 40; attempt++) {
    const itemStr = await db.hget<any>("media:queue", mediaId);
    if (itemStr) {
      const item = typeof itemStr === "string" ? JSON.parse(itemStr) : itemStr;
      if (item.status === "completed") {
        console.log(`[Products API] Queued media ${mediaId} completed optimization! Shopify ID: ${item.shopifyId}`);
        // Clean up from Redis hash queue since it is successfully bound
        await db.hdel("media:queue", mediaId);
        return { id: item.shopifyId, url: item.shopifyUrl };
      } else if (item.status === "failed") {
        throw new Error(`Media optimization failed: ${item.error || "unknown error"}`);
      }
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  throw new Error("Media optimization timed out inside queue. Please try again.");
}

// POST: Create a new Saree
export async function POST(req: NextRequest) {
  try {
    if (!await verifySession()) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const body = await req.json();
    const { costPrice, privateNotes, ...sareeData } = body;

    if (!sareeData.sku || !sareeData.title || !sareeData.price) {
      return NextResponse.json({ error: "SKU, Title, and Price are required" }, { status: 400 });
    }

    // Resolve queued shortVideo if present
    if (sareeData.metafields?.shortVideo) {
      sareeData.metafields.shortVideo = await resolveQueuedMedia(sareeData.metafields.shortVideo);
    }

    console.log(`⏳ Pushing new Saree to Shopify: ${sareeData.sku}...`);
    // 1. Create Saree in Shopify
    const createdProduct = await shopifySaree.create(sareeData);

    console.log(`✅ Saree created in Shopify. ID: ${createdProduct.id}`);

    // 2. Save private Cost Price metadata to Redis
    const cost = parseFloat(costPrice || "0");
    const margin = sareeData.price > 0 ? (sareeData.price - cost) / sareeData.price : 0;
    
    await sareeDb.set(sareeData.sku, {
      costPrice: cost,
      margin,
      privateNotes: privateNotes || ""
    });

    console.log(`✅ Private cost metrics saved to Redis for SKU: ${sareeData.sku}`);

    return NextResponse.json({ success: true, product: createdProduct });
  } catch (err: any) {
    console.error("Product create API failure:", err);
    return NextResponse.json({ error: err.message || "Failed to create product" }, { status: 500 });
  }
}

// PUT: Update an existing Saree
export async function PUT(req: NextRequest) {
  try {
    if (!await verifySession()) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const body = await req.json();
    const { id, costPrice, privateNotes, ...sareeData } = body;

    if (!id) {
      return NextResponse.json({ error: "Product ID is required for update" }, { status: 400 });
    }

    // Resolve queued shortVideo if present
    if (sareeData.metafields?.shortVideo) {
      sareeData.metafields.shortVideo = await resolveQueuedMedia(sareeData.metafields.shortVideo);
    }

    console.log(`⏳ Updating Saree ${id} in Shopify...`);
    // 1. Update in Shopify
    const updatedProduct = await shopifySaree.update(id, sareeData);

    // 2. Save private Cost Price metadata to Redis if costPrice is supplied
    if (costPrice !== undefined && updatedProduct.sku) {
      const cost = parseFloat(costPrice || "0");
      const margin = updatedProduct.price > 0 ? (updatedProduct.price - cost) / updatedProduct.price : 0;

      await sareeDb.set(updatedProduct.sku, {
        costPrice: cost,
        margin,
        privateNotes: privateNotes || ""
      });
      console.log(`✅ Private cost metrics updated in Redis for SKU: ${updatedProduct.sku}`);
    }

    return NextResponse.json({ success: true, product: updatedProduct });
  } catch (err: any) {
    console.error("Product update API failure:", err);
    return NextResponse.json({ error: err.message || "Failed to update product" }, { status: 500 });
  }
}
