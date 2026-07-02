import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export const revalidate = 0; // Dynamic route

const DEFAULT_STORY = `Reshmi Pallu was born out of a deep reverence for the timeless legacy of Indian handloom weaving. Growing up amidst the rich textile heritage of Varanasi, our founder Mrinalini Singh witnessed firsthand the incredible precision, patience, and poetry woven into every single saree by local master craftsmen.

Each saree we design at Reshmi Pallu tells a distinct tale—from the selection of the finest pure Banarasi mulberry silks and organic dyes, to the meticulously planned zari motifs that dance across the borders. Our ethos rests on three absolute pillars: preserving the raw authenticity of handloom craftsmanship, advocating fair wages and support for weaving communities, and delivering an unmatched, weightless drape experience to modern women who carry tradition in their hearts.

We don't just sell sarees; we share a piece of history, an heirloom to be passed down through generations. Thank you for being a part of our beautiful journey and preserving this priceless heritage with us.`;

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("crm_session");
    if (!session || session.value !== "authenticated") {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const text = await db.get<string>("founder:story:text") || DEFAULT_STORY;
    const image = await db.get<string>("founder:story:image") || "";

    return NextResponse.json({ text, image });
  } catch (err: any) {
    console.error("Failed to fetch founder story:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch story" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("crm_session");
    if (!session || session.value !== "authenticated") {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const body = await req.json();
    const { text, image, imageBase64Key } = body;

    const pipeline = db.pipeline();
    pipeline.set("founder:story:text", text || "");
    pipeline.set("founder:story:image", image || "");

    let imageBase64Idx = -1;
    if (imageBase64Key) {
      pipeline.get(imageBase64Key);
      imageBase64Idx = 2; // pipeline has 2 sets before this
    }

    const results = await pipeline.exec();

    // Copy base64 to stable slot so the storefront proxy always has a copy
    if (imageBase64Idx !== -1) {
      const base64Data = results[imageBase64Idx] as string | null;
      if (base64Data) {
        const TWO_YEARS = 2 * 365 * 24 * 3600;
        await db.set("brand-image-data:founder", base64Data, { ex: TWO_YEARS });
        console.log("[Founder Story] Copied image base64 to stable slot brand-image-data:founder");
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Failed to save founder story:", err);
    return NextResponse.json({ error: err.message || "Failed to save story" }, { status: 500 });
  }
}
