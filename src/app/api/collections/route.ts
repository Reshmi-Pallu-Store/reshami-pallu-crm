import { NextRequest, NextResponse } from "next/server";
import { shopifyCollection } from "@/lib/shopify";
import { cookies } from "next/headers";

async function verifySession() {
  const cookieStore = await cookies();
  const session = cookieStore.get("crm_session");
  return session && session.value === "authenticated";
}

// POST: Create a new automated smart collection
export async function POST(req: NextRequest) {
  try {
    if (!await verifySession()) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const { title, tag } = await req.json();

    if (!title || !tag) {
      return NextResponse.json({ error: "Title and Tag are required fields" }, { status: 400 });
    }

    console.log(`⏳ Creating automated Smart Collection: ${title} matching tag: ${tag}...`);
    const success = await shopifyCollection.createSmart(title, tag);

    if (success) {
      console.log(`✅ Collection ${title} created successfully in Shopify.`);
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: "Failed to create collection in Shopify" }, { status: 500 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server Error" }, { status: 500 });
  }
} 
export async function GET(req: NextRequest) {
  try {
    const collections = await shopifyCollection.list(250);
    const titles = collections.map((c: any) => c.title);
    return NextResponse.json({ collections: titles });
  } catch (err: any) {
    console.error("Collections API GET failure:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch collections" }, { status: 500 });
  }
}
