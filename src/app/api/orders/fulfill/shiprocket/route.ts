import { NextRequest, NextResponse } from "next/server";
import { bookShipmentWithShiprocket } from "@/lib/shiprocket";
import { shopifyOrder } from "@/lib/shopify";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      orderId,
      orderName,
      customerName,
      customerEmail,
      phone,
      address1,
      address2,
      city,
      province,
      zip,
      weight,
      items,
      subtotal,
    } = body;

    if (!orderId || !customerName || !phone || !address1 || !city || !province || !zip) {
      return NextResponse.json({ error: "Missing required order or address details." }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Missing ordered items for Shiprocket booking." }, { status: 400 });
    }

    // 1. Book the shipment with Shiprocket
    const booking = await bookShipmentWithShiprocket({
      orderId: orderName || orderId,
      customerName,
      customerEmail: customerEmail || undefined,
      address: {
        line1: address1,
        line2: address2 || "",
        city,
        state: province,
        pincode: zip,
        mobile: phone,
      },
      items: items.map(item => ({
        name: item.name || item.title || "Saree Item",
        sku: item.sku || "SAREE",
        qty: Number(item.qty || item.quantity || 1),
        price: Number(item.price || 0),
      })),
      subtotal: subtotal ? Number(subtotal) : items.reduce((acc, i) => acc + Number(i.price || 0) * Number(i.qty || 1), 0),
      weightKg: weight ? Number(weight) : 0.5,
    });

    if (!booking.success || !booking.awb) {
      return NextResponse.json({ error: booking.error || "Failed to book shipment on Shiprocket." }, { status: 502 });
    }

    // 2. Mark the order as fulfilled on Shopify
    try {
      await shopifyOrder.fulfillOrder(orderId, booking.awb, "Shiprocket");
    } catch (err: any) {
      console.error("Shopify fulfillment sync failed for Shiprocket:", err);
      // Even if Shopify update fails, we return the Shiprocket AWB so the merchant doesn't lose it!
      return NextResponse.json({
        ok: true,
        awb: booking.awb,
        courierName: booking.courierName,
        warning: "Shiprocket booked successfully, but Shopify fulfillment update failed: " + err.message,
      });
    }

    return NextResponse.json({
      ok: true,
      awb: booking.awb,
      courierName: booking.courierName,
      message: "Order successfully booked with Shiprocket and marked as fulfilled!",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Fulfillment booking failed." }, { status: 500 });
  }
}
