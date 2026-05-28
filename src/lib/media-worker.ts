import { db } from "./db";
import { shopifySaree } from "./shopify";
import { promises as fs } from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import sharp from "sharp";

const execPromise = promisify(exec);

export async function processQueueAsync() {
  // Trigger asynchronously in non-blocking fashion
  (async () => {
    try {
      const queue = await db.hgetall("media:queue");
      if (!queue) return;

      const items = Object.values(queue).map((val: any) => 
        typeof val === "string" ? JSON.parse(val) : val
      );

      // Filter for items that are queued
      const queuedItems = items.filter(item => item && item.status === "queued");

      for (const item of queuedItems) {
        // Mark as processing to avoid duplicate runs
        const processingItem = { ...item, status: "processing", startedAt: new Date().toISOString() };
        await db.hset("media:queue", { [item.id]: JSON.stringify(processingItem) });

        const filename = path.basename(item.path);
        const absoluteRawPath = path.join(process.cwd(), "tmp/uploads", filename);
        const ext = item.type === "image" ? ".webp" : ".mp4";
        const optimizedFilename = filename.replace(/\.[^/.]+$/, "") + "_optimized" + ext;
        const relativeOptimizedPath = `tmp/uploads/${optimizedFilename}`;
        const absoluteOptimizedPath = path.join(process.cwd(), "tmp/uploads", optimizedFilename);

        try {
          console.log(`[Media Worker] Optimizing queued item ${item.id} (${item.type})...`);

          if (item.type === "image") {
            // 1. Image Optimization: Crop/Resize to 2:3 vertical ratio, quality 82 WebP
            await sharp(absoluteRawPath)
              .resize(1000, 1500, {
                fit: "cover",
                position: "center",
              })
              .webp({ quality: 82 })
              .toFile(absoluteOptimizedPath);

          } else {
            // 2. Video Optimization: Strip audio, scale height to 1280px vertical, compress bitrates
            try {
              const ffmpegCmd = `/opt/homebrew/bin/ffmpeg -y -i "${absoluteRawPath}" -an -vf "scale=-2:1280" -vcodec libx264 -crf 26 -preset fast "${absoluteOptimizedPath}"`;
              await execPromise(ffmpegCmd);
            } catch (ffmpegErr) {
              console.warn("[Media Worker] FFmpeg full scale failed, fallback to silent copy...", ffmpegErr);
              const fallbackCmd = `/opt/homebrew/bin/ffmpeg -y -i "${absoluteRawPath}" -an -vcodec copy "${absoluteOptimizedPath}"`;
              await execPromise(fallbackCmd);
            }
          }

          // 3. Upload Optimized file to Shopify staged targets CDN
          const fileBuffer = await fs.readFile(absoluteOptimizedPath);
          const fileName = `${item.id}${ext}`;
          const mimeType = item.type === "image" ? "image/webp" : "video/mp4";

          console.log(`[Media Worker] Uploading optimized ${fileName} to Shopify staged target...`);
          const result = await shopifySaree.uploadMedia(fileName, mimeType, fileBuffer);

          // 4. Mark status as completed
          const completedItem = {
            ...item,
            status: "completed",
            shopifyId: result.id,
            shopifyUrl: result.url,
            optimizedPath: relativeOptimizedPath,
            completedAt: new Date().toISOString()
          };
          await db.hset("media:queue", { [item.id]: JSON.stringify(completedItem) });
          console.log(`[Media Worker] Item ${item.id} successfully synced to Shopify!`);

          // 5. Clean up temporary files on local disk
          try {
            await fs.unlink(absoluteRawPath);
            await fs.unlink(absoluteOptimizedPath);
          } catch (unlinkErr) {
            console.error("[Media Worker] Disk cleanup warning:", unlinkErr);
          }

        } catch (err: any) {
          console.error(`[Media Worker] Process failed for item ${item.id}:`, err);
          const failedItem = {
            ...item,
            status: "failed",
            error: err.message || "Transformation failed",
            failedAt: new Date().toISOString()
          };
          await db.hset("media:queue", { [item.id]: JSON.stringify(failedItem) });
        }
      }
    } catch (err) {
      console.error("[Media Worker] Queue loop execution failure:", err);
    }
  })();
}
