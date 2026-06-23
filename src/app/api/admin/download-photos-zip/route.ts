import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import fs from "fs";
import path from "path";
import os from "os";
import AdmZip from "adm-zip";

async function verifySession() {
  const cookieStore = await cookies();
  const session = cookieStore.get("crm_session");
  return session && session.value === "authenticated";
}

export async function GET(req: NextRequest) {
  try {
    if (!await verifySession()) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const serialNumber = searchParams.get("serialNumber");

    const baseDir = path.join(os.tmpdir(), "inventory");
    if (!fs.existsSync(baseDir)) {
      return NextResponse.json({ error: "No inventory directories exist. Run sync first." }, { status: 404 });
    }

    const zip = new AdmZip();

    if (serialNumber && serialNumber !== "all") {
      const itemDir = path.join(baseDir, serialNumber.trim());
      if (!fs.existsSync(itemDir)) {
        return NextResponse.json({ error: `No photos found for saree serial number ${serialNumber}.` }, { status: 404 });
      }
      
      // Zip single saree folder
      zip.addLocalFolder(itemDir);
      const zipBuffer = zip.toBuffer();

      return new NextResponse(zipBuffer, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="saree_${serialNumber}_photos.zip"`,
        },
      });
    } else {
      // Zip the entire inventory temp folder containing all sarees
      zip.addLocalFolder(baseDir);
      const zipBuffer = zip.toBuffer();

      return new NextResponse(zipBuffer, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="all_synced_photos_${new Date().toISOString().slice(0, 10)}.zip"`,
        },
      });
    }
  } catch (err: any) {
    console.error("ZIP Generation failure:", err);
    return NextResponse.json({ error: err.message || "Failed to package photos zip" }, { status: 500 });
  }
}
