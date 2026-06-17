const SHIPROCKET_EMAIL = process.env.SHIPROCKET_EMAIL;
const SHIPROCKET_PASSWORD = process.env.SHIPROCKET_PASSWORD;

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0; // Epoch in ms

async function getShiprocketToken(): Promise<string | null> {
  if (!SHIPROCKET_EMAIL || !SHIPROCKET_PASSWORD) {
    console.error("Missing Shiprocket credentials in environment variables.");
    return null;
  }

  // Check if token is still valid (leaving a 1-minute buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  try {
    const res = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: SHIPROCKET_EMAIL,
        password: SHIPROCKET_PASSWORD,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Auth failed with status ${res.status}: ${text}`);
    }

    const data = await res.json();
    if (data.token) {
      cachedToken = data.token;
      // Shiprocket tokens are generally valid for 10 days, let's cache for 24 hours to be safe
      tokenExpiresAt = Date.now() + 24 * 60 * 60 * 1000;
      return cachedToken;
    }
  } catch (err) {
    console.error("Failed to authenticate with Shiprocket:", err);
  }
  return null;
}

export async function getShiprocketTracking(awb: string): Promise<any | null> {
  try {
    const token = await getShiprocketToken();
    if (!token) return null;

    const res = await fetch(`https://apiv2.shiprocket.in/v1/external/courier/track/awb/${encodeURIComponent(awb)}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      console.warn(`Shiprocket tracking returned status ${res.status} for AWB ${awb}`);
      return null;
    }

    const data = await res.json();
    
    // Format response to match standard tracking object
    // Shiprocket returns tracking data inside tracking_data
    const trackingData = data?.tracking_data;
    if (!trackingData || trackingData.track_status === 0) {
      return null;
    }

    const awbData = trackingData.shipment_track?.[0];
    if (!awbData) return null;

    // Normalize tracking status:
    // Delhivery has statuses like "In Transit", "Delivered", "Out for Delivery", etc.
    // Shiprocket has current_status (e.g. "PICKED UP", "IN TRANSIT", "OUT FOR DELIVERY", "DELIVERED")
    const status = awbData.current_status || "Dispatched";

    return {
      status: status,
      courierName: awbData.courier_name || "Shiprocket",
      updatedAt: awbData.scans?.[0]?.date || new Date().toISOString(),
    };
  } catch (err) {
    console.error(`Error fetching Shiprocket tracking for AWB ${awb}:`, err);
    return null;
  }
}
