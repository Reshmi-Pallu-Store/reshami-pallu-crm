import { NextRequest, NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { db } from "@/lib/db";
import { processQueueAsync } from "@/lib/media-worker";
// @ts-ignore
import heicConvert from "heic-convert";

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
    
    // Save raw file on OS temp disk (completely outside Next.js project root to prevent watch loops)
    const uploadDir = path.join(os.tmpdir(), "reshami-pallu-uploads");
    await fs.mkdir(uploadDir, { recursive: true });

    let ext = path.extname(file.name).toLowerCase() || (file.type.startsWith("video/") ? ".mp4" : ".jpg");
    let mimeType = file.type;
    let buffer = Buffer.from(await file.arrayBuffer());

    // Automatic HEIC to JPEG conversion for iPhone images
    if (ext === ".heic" || ext === ".heif" || mimeType === "image/heic" || mimeType === "image/heif") {
      try {
        console.log(`[Upload API] Converting HEIC image ${file.name} to JPEG for iPhone compatibility...`);
        const converted = await heicConvert({
          buffer: buffer,
          format: "JPEG",
          quality: 0.9
        });
        buffer = Buffer.from(converted);
        ext = ".jpg";
        mimeType = "image/jpeg";
      } catch (convErr: any) {
        console.error("[Upload API] HEIC conversion failed, keeping original:", convErr);
      }
    }

    const absolutePath = path.join(uploadDir, `${mediaId}${ext}`);
    await fs.writeFile(absolutePath, buffer);

    // Register queue metadata inside Upstash Redis hash
    const queueItem = {
      id: mediaId,
      path: absolutePath, // Save the absolute path directly
      status: "queued",
      type: mimeType.startsWith("video/") ? "video" : "image",
      originalName: file.name.replace(/\.(heic|heif)$/i, ".jpg"),
      mimeType: mimeType,
      createdAt: new Date().toISOString()
    };
    await db.hset("media:queue", { [mediaId]: JSON.stringify(queueItem) });

    console.log(`[Queue API] Registered media ${mediaId} in Upstash Redis. Triggering async worker...`);
    
    // Trigger the background media optimizer thread (non-blocking!)
    after(processQueueAsync());

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
