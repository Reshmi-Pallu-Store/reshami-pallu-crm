import { NextRequest, NextResponse } from "next/server";
import { shopifySaree } from "@/lib/shopify";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    // 1. Session verification
    const cookieStore = await cookies();
    const session = cookieStore.get("crm_session");
    if (!session || session.value !== "authenticated") {
      return NextResponse.json({ error: "Unauthorized administrative access" }, { status: 401 });
    }

    // 2. Parse Multipart form
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file was uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name;
    const mimeType = file.type;

    console.log(`⏳ Uploading file to Shopify: ${fileName} (${mimeType}, ${buffer.length} bytes)...`);

    // 3. Perform staged upload & registration in Shopify Admin API
    const result = await shopifySaree.uploadMedia(fileName, mimeType, buffer);

    console.log(`✅ Upload success! File ID: ${result.id}, URL: ${result.url}`);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("API Upload Error:", err);
    return NextResponse.json({ error: err.message || "Failed to upload file to Shopify" }, { status: 500 });
  }
}
