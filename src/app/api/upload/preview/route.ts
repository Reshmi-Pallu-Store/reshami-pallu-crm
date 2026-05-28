import { db } from "@/lib/db";
import { NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const revalidate = 0; // Disable server cache

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return new Response("Missing id parameter", { status: 400 });
    }

    const itemStr = await db.hget<any>("media:queue", id);
    if (!itemStr) {
      return new Response("Media reference not found in Redis", { status: 404 });
    }

    const item = typeof itemStr === "string" ? JSON.parse(itemStr) : itemStr;
    const absolutePath = item.path;

    try {
      const fileBuffer = await fs.readFile(absolutePath);
      return new Response(fileBuffer, {
        headers: {
          "Content-Type": item.mimeType || "application/octet-stream",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch (e) {
      return new Response("Local file not found on disk", { status: 404 });
    }
  } catch (err: any) {
    console.error("Preview API stream error:", err);
    return new Response(err.message, { status: 500 });
  }
}
