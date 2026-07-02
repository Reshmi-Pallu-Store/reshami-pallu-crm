import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export const revalidate = 0; // Dynamic route

export async function GET(req: NextRequest) {
  try {
    // 1. Session verification
    const cookieStore = await cookies();
    const session = cookieStore.get("crm_session");
    if (!session || session.value !== "authenticated") {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const heroImage = await db.get<string>("brand:hero:image") || "/images/hero-reshami-pallu.png";
    const heroTitle = await db.get<string>("brand:hero:title") || "BORN TO DAZZLE";
    const heroSubtitle = await db.get<string>("brand:hero:subtitle") || "CRAFTED TO STAND OUT—JUST LIKE YOU.";
    const heroEnabledRaw = await db.get<any>("brand:hero:enabled");
    const heroEnabled = heroEnabledRaw === null ? true : (heroEnabledRaw === true || heroEnabledRaw === "true");
    const loginImage = await db.get<string>("brand:login:image") || "/images/hero-reshami-pallu.png";

    return NextResponse.json({ heroImage, heroTitle, heroSubtitle, loginImage, heroEnabled });
  } catch (err: any) {
    console.error("Failed to fetch brand customizer settings:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch settings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Session verification
    const cookieStore = await cookies();
    const session = cookieStore.get("crm_session");
    if (!session || session.value !== "authenticated") {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const body = await req.json();
    const { heroImage, heroTitle, heroSubtitle, loginImage, heroEnabled, heroImageBase64Key, loginImageBase64Key } = body;

    const pipeline = db.pipeline();

    if (heroImage !== undefined) pipeline.set("brand:hero:image", heroImage || "");
    if (heroTitle !== undefined) pipeline.set("brand:hero:title", heroTitle || "");
    if (heroSubtitle !== undefined) pipeline.set("brand:hero:subtitle", heroSubtitle || "");
    if (loginImage !== undefined) pipeline.set("brand:login:image", loginImage || "");
    if (heroEnabled !== undefined) pipeline.set("brand:hero:enabled", String(heroEnabled));

    // Queue GET requests in the same pipeline to save round trips
    let heroBase64Idx = -1;
    let loginBase64Idx = -1;
    let cmdCount = 0;

    if (heroImage !== undefined) cmdCount++;
    if (heroTitle !== undefined) cmdCount++;
    if (heroSubtitle !== undefined) cmdCount++;
    if (loginImage !== undefined) cmdCount++;
    if (heroEnabled !== undefined) cmdCount++;

    if (heroImageBase64Key) {
      pipeline.get(heroImageBase64Key);
      heroBase64Idx = cmdCount;
      cmdCount++;
    }
    if (loginImageBase64Key) {
      pipeline.get(loginImageBase64Key);
      loginBase64Idx = cmdCount;
      cmdCount++;
    }

    const results = await pipeline.exec();

    // Copy base64 image data from the temp media key to a stable named slot if retrieved.
    const TWO_YEARS = 2 * 365 * 24 * 3600;
    const writePipeline = db.pipeline();
    let needsWrite = false;

    if (heroBase64Idx !== -1) {
      const base64Data = results[heroBase64Idx] as string | null;
      if (base64Data) {
        writePipeline.set("brand-image-data:hero", base64Data, { ex: TWO_YEARS });
        needsWrite = true;
        console.log("[Customizer] Copied hero base64 to stable slot brand-image-data:hero");
      }
    }
    if (loginBase64Idx !== -1) {
      const base64Data = results[loginBase64Idx] as string | null;
      if (base64Data) {
        writePipeline.set("brand-image-data:login", base64Data, { ex: TWO_YEARS });
        needsWrite = true;
        console.log("[Customizer] Copied login base64 to stable slot brand-image-data:login");
      }
    }

    if (needsWrite) {
      await writePipeline.exec();
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Failed to save brand customizer settings:", err);
    return NextResponse.json({ error: err.message || "Failed to save settings" }, { status: 500 });
  }
}
