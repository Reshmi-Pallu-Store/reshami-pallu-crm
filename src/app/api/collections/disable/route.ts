import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";

async function verifySession() {
  const cookieStore = await cookies();
  const session = cookieStore.get("crm_session");
  return session && session.value === "authenticated";
}

export async function GET(req: NextRequest) {
  try {
    if (!await verifySession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const disabledTags = await db.smembers("storefront:disabled_tags") || [];
    return NextResponse.json({ disabledTags });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!await verifySession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { tag, disabled } = await req.json();
    
    if (!tag) return NextResponse.json({ error: "Tag is required" }, { status: 400 });

    // Protect "All Sarees" and "Founder's Exclusive" just in case it hits the backend
    const lowerTag = tag.toLowerCase();
    if (lowerTag === "all sarees" || lowerTag.includes("founder")) {
      return NextResponse.json({ error: "Cannot disable this protected collection" }, { status: 400 });
    }

    if (disabled) {
      await db.sadd("storefront:disabled_tags", lowerTag);
    } else {
      await db.srem("storefront:disabled_tags", lowerTag);
      await db.srem("storefront:disabled_tags", tag);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
