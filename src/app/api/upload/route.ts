import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { promises as fs } from "fs";
import path from "path";
import { db } from "@/lib/db";
import { processQueueAsync } from "@/lib/media-worker";

export const revalidate = 0; // Dynamic route

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

    const mediaId = "media_" + Math.random().toString(36).substring(2, 11);
    
    // Save raw file on local disk temporarily
    const uploadDir = path.join(process.cwd(), "tmp/uploads");
    await fs.mkdir(uploadDir, { recursive: true });

    const ext = path.extname(file.name) || (file.type.startsWith("video/") ? ".mp4" : ".jpg");
    const relativePath = `tmp/uploads/${mediaId}${ext}`;
    const absolutePath = path.join(process.cwd(), relativePath);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(absolutePath, buffer);

    // Register queue metadata inside Upstash Redis hash
    const queueItem = {
      id: mediaId,
      path: relativePath,
      status: "queued",
      type: file.type.startsWith("video/") ? "video" : "image",
      originalName: file.name,
      mimeType: file.type,
      createdAt: new Date().toISOString()
    };
    await db.hset("media:queue", { [mediaId]: JSON.stringify(queueItem) });

    console.log(`[Queue API] Registered media ${mediaId} in Upstash Redis. Triggering async worker...`);
    
    // Trigger the background media optimizer thread (non-blocking!)
    processQueueAsync();

    // Instantly return the local stream preview details (takes < 150ms!)
    return NextResponse.json({
      id: mediaId,
      url: `/api/upload/preview?id=${mediaId}`,
      status: "queued"
    });
  } catch (err: any) {
    console.error("API Upload Error:", err);
    return NextResponse.json({ error: err.message || "Failed to initiate file queue" }, { status: 500 });
  }
}
