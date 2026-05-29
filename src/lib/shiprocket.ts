import { db } from "./db";

const SHIPROCKET_BASE = "https://apiv2.shiprocket.in";
const TOKEN_REDIS_KEY = "shiprocket:token";
const TOKEN_REDIS_TTL_HOURS = 230; // token valid for 240 hours
const FETCH_TIMEOUT_MS = 10_000;

export interface ShiprocketTrackingActivity {
  date: string;
  status: string;
  activity: string;
  location: string;
}

export interface NormalizedTracking {
  status: string;
  edd: string;
  deliveredDate: string;
  activities: ShiprocketTrackingActivity[];
}

export interface BookShipmentInput {
  orderId: string;
  orderDate?: string;
  customerName: string;
  customerEmail?: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
    mobile: string;
  };
  items: Array<{
    name: string;
    sku: string;
    qty: number;
    price: number;
  }>;
  subtotal: number;
  weightKg?: number;
}

export interface BookingResult {
  success: boolean;
  awb?: string;
  shipmentId?: number;
  orderId?: number;
  courierName?: string;
  error?: string;
}

// Check configuration
export function hasShiprocketConfig(): boolean {
  return Boolean(process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD);
}

// Fetch new Auth Token from Shiprocket
async function fetchNewToken(): Promise<string> {
  const res = await fetch(`${SHIPROCKET_BASE}/v1/external/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD,
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`Shiprocket Auth failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as { token?: string };
  if (!data.token) {
    throw new Error("Shiprocket Auth response did not return a valid token.");
  }
  return data.token;
}

// Get Cached Auth Token (with automatic refresh)
export async function getShiprocketToken(): Promise<string> {
  try {
    const cached = await db.get<string>(TOKEN_REDIS_KEY);
    if (cached) return cached;
  } catch (err) {
    console.warn("Failed to read Shiprocket token from Redis:", err);
  }

  const token = await fetchNewToken();

  try {
    await db.set(TOKEN_REDIS_KEY, token, {
      ex: TOKEN_REDIS_TTL_HOURS * 3600,
    });
  } catch (err) {
    console.error("Failed to cache Shiprocket token in Redis:", err);
  }

  return token;
}

// API Fetch helper
async function shiprocketFetch<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: Record<string, any>;
    params?: Record<string, string>;
  } = {}
): Promise<T> {
  const token = await getShiprocketToken();
  const method = options.method ?? "GET";

  let url = `${SHIPROCKET_BASE}${path}`;
  if (options.params) {
    const qs = new URLSearchParams(options.params).toString();
    url += `?${qs}`;
  }

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    ...(method === "POST" && options.body
      ? { body: JSON.stringify(options.body) }
      : {}),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Shiprocket API error: ${res.status} ${res.statusText} - ${errorText}`);
  }

  return res.json() as Promise<T>;
}

// Get tracking details
export async function getTrackingByAwb(awbCode: string): Promise<NormalizedTracking | null> {
  if (!hasShiprocketConfig()) return null;

  try {
    const response = await shiprocketFetch<{
      tracking_data: {
        track_status: number;
        shipment_status: number;
        shipment_track?: Array<{
          current_status: string;
          delivered_date?: string;
          edd?: string;
        }>;
        shipment_track_activities?: Array<{
          date: string;
          status: string;
          activity: string;
          location: string;
        }>;
      };
    }>(`/v1/external/courier/track/awb/${awbCode}`);

    const track = response.tracking_data?.shipment_track?.[0];
    if (!track) return null;

    const activities = (response.tracking_data?.shipment_track_activities || []).map(act => ({
      date: act.date,
      status: act.status,
      activity: act.activity,
      location: act.location,
    }));

    return {
      status: track.current_status || "Manifested",
      edd: track.edd || "",
      deliveredDate: track.delivered_date || "",
      activities,
    };
  } catch (err) {
    console.error(`Shiprocket tracking fetch failed for AWB ${awbCode}:`, err);
    return null;
  }
}

// Book dynamic forward shipment
export async function bookShipmentWithShiprocket(
  input: BookShipmentInput
): Promise<BookingResult> {
  if (!hasShiprocketConfig()) {
    return { success: false, error: "Shiprocket credentials are not configured in environment." };
  }

  const {
    orderId,
    orderDate = new Date().toISOString().split("T")[0],
    customerName,
    customerEmail = "customer@reshmipallu.com",
    address,
    items,
    subtotal,
    weightKg = 0.5,
  } = input;

  try {
    const nameParts = customerName.trim().split(" ");
    const firstName = nameParts[0] || "Customer";
    const lastName = nameParts.slice(1).join(" ") || "ReshmiPallu";

    // 1. Create Forward Order Shipment in Shiprocket
    const payload = {
      order_id: orderId,
      order_date: orderDate,
      pickup_location: "RESHMI PALLU",
      billing_customer_name: firstName,
      billing_last_name: lastName,
      billing_address: address.line1,
      billing_address_2: address.line2 || "",
      billing_city: address.city,
      billing_pincode: address.pincode,
      billing_state: address.state,
      billing_country: "India",
      billing_email: customerEmail,
      billing_phone: address.mobile,
      shipping_is_billing: true,
      order_items: items.map(item => ({
        name: item.name,
        sku: item.sku || "SAREE",
        units: item.qty,
        selling_price: item.price,
      })),
      payment_method: "Prepaid",
      sub_total: subtotal,
      length: 10,
      breadth: 10,
      height: 5,
      weight: weightKg,
    };

    const orderRes = await shiprocketFetch<{
      order_id: number;
      shipment_id: number;
      status?: string;
      status_code?: number;
    }>("/v1/external/shipments/create/forward-shipment", {
      method: "POST",
      body: payload,
    });

    if (!orderRes.shipment_id) {
      throw new Error("Shiprocket created order but failed to return shipment ID.");
    }

    // 2. Generate AWB for this shipment using cheapest carrier automatically
    const awbRes = await shiprocketFetch<{
      status: number;
      response?: {
        data?: {
          awb_code?: string;
          courier_name?: string;
        };
      };
    }>("/v1/external/courier/assign/awb", {
      method: "POST",
      body: {
        shipment_id: orderRes.shipment_id,
      },
    });

    const awb = awbRes.response?.data?.awb_code;
    if (!awb) {
      throw new Error("Shiprocket created order but AWB allocation failed.");
    }

    return {
      success: true,
      awb,
      shipmentId: orderRes.shipment_id,
      orderId: orderRes.order_id,
      courierName: awbRes.response?.data?.courier_name || "Shiprocket Premium Courier",
    };
  } catch (err: any) {
    console.error("Shiprocket shipment booking failed:", err);
    return {
      success: false,
      error: err.message || "Shiprocket shipment booking failed.",
    };
  }
}

// Cancel booking using AWB code
export async function cancelShipmentWithShiprocket(awbCode: string): Promise<boolean> {
  if (!hasShiprocketConfig()) return false;

  try {
    const res = await shiprocketFetch<{ status: number }>("/v1/external/orders/cancel/shipment/awbs", {
      method: "POST",
      body: {
        awbs: [awbCode],
      },
    });
    return res.status === 200;
  } catch (err) {
    console.error(`Shiprocket cancellation failed for AWB ${awbCode}:`, err);
    return false;
  }
}
