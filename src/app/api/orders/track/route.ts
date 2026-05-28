import { NextRequest, NextResponse } from "next/server";
import { getTrackingByAwb } from "@/lib/delhivery";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const awb = searchParams.get("awb") || "";

    if (!awb) {
      return NextResponse.json({ error: "AWB code is required" }, { status: 400 });
    }

    const tracking = await getTrackingByAwb(awb);
    if (!tracking) {
      return NextResponse.json({ error: "Tracking data not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, tracking });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch tracking" }, { status: 500 });
  }
}
