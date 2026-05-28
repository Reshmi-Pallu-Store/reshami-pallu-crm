const DEV_BASE = "https://staging-express.delhivery.com";
const LIVE_BASE = "https://track.delhivery.com";
const FETCH_TIMEOUT_MS = 10_000;

export interface NormalizedTracking {
  status: string;
  edd: string;
  deliveredDate: string;
  activities: Array<{
    activity: string;
    location: string;
    date: string;
  }>;
}

export function getBaseUrl(): string {
  const mode = (process.env.DELHIVERY_MODE || "test").toLowerCase();
  return mode === "live" ? LIVE_BASE : DEV_BASE;
}

export async function getTrackingByAwb(awbCode: string): Promise<NormalizedTracking | null> {
  const token = process.env.DELHIVERY_API_TOKEN || "";
  if (!token) return null;

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/v1/packages/json/?waybill=${awbCode}&token=${token}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Token ${token}`,
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });

    if (!res.ok) return null;
    const response = await res.json();
    
    const shipmentDataList = response?.ShipmentData || [];
    if (shipmentDataList.length === 0) return null;

    const shipment = shipmentDataList[0]?.Shipment;
    if (!shipment) return null;

    const currentStatus = shipment.Status?.Status || "Manifested";
    const edd = shipment.ExpectedDeliveryDate || "";
    const deliveredDate = shipment.DeliveryDate || "";

    const rawScans = shipment.Scans || [];
    const activities = rawScans.map((scan: any) => {
      const detail = scan.ScanDetail;
      return {
        activity: detail?.Scan || detail?.Status || "Parcel processed",
        location: detail?.ScannedLocation || "",
        date: detail?.ScanDateTime || new Date().toISOString(),
      };
    });

    return {
      status: currentStatus,
      edd,
      deliveredDate,
      activities,
    };
  } catch (err) {
    console.error("Delhivery tracking fetch failed in CRM:", err);
    return null;
  }
}
