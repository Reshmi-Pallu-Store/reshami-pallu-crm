"use client";

import { useState } from "react";
import { 
  Search, 
  Eye, 
  Calendar, 
  MapPin, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  Package,
  Receipt
} from "lucide-react";
import OrderDetailModal from "./OrderDetailModal";

interface OrdersListTableProps {
  initialOrders: any[];
  metaMap: Record<string, { costPrice: number; margin: number; privateNotes?: string }>;
}

export default function OrdersListTable({ initialOrders, metaMap }: OrdersListTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  // Compute order details locally to display profit margins in the main table list
  const getOrderNetMargin = (order: any) => {
    let totalOrderCost = 0;
    order.lineItems?.edges?.forEach((e: any) => {
      const node = e.node;
      const sku = node.sku || "";
      const qty = node.quantity || 1;
      const meta = metaMap[sku];
      totalOrderCost += (meta?.costPrice || 0) * qty;
    });

    const totalRetail = parseFloat(order.totalPriceSet?.presentmentMoney?.amount || "0");
    const profit = totalRetail - totalOrderCost;
    const marginPercent = totalRetail > 0 ? (profit / totalRetail) * 100 : 0;
    return { totalRetail, totalOrderCost, profit, marginPercent };
  };

  // Filter orders by search input (matching order name, customer name, phone, or tags)
  const filteredOrders = initialOrders.filter((order) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    const orderName = String(order.name || "").toLowerCase();
    const customerName = `${order.customer?.firstName || ""} ${order.customer?.lastName || ""}`.toLowerCase();
    const phone = String(order.customer?.phone || "").toLowerCase();
    const tags = order.tags?.join(" ").toLowerCase() || "";

    return (
      orderName.includes(query) ||
      customerName.includes(query) ||
      phone.includes(query) ||
      tags.includes(query)
    );
  });

  const getMarginColor = (margin: number) => {
    if (margin >= 40) return "text-green-600 bg-green-50 border-green-200";
    if (margin >= 20) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  return (
    <div className="space-y-6">
      
      {/* Top Title Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/40 border border-[#4A154B]/10 rounded-2xl p-4 sm:p-6 backdrop-blur-md">
        <div>
          <h3 className="font-display font-bold text-base sm:text-lg text-[#4A154B] flex items-center gap-2">
            <Receipt size={18} className="text-[#D4AF37]" />
            Live Customer Orders
          </h3>
          <p className="text-xs text-[#1A1A1A]/60 mt-0.5">
            Audit customer payments, dynamic delivery states, and weaver profit margins.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="Search by Order #, Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-xl border border-[#4A154B]/10 bg-white text-xs outline-none focus:border-[#4A154B] focus:ring-1 focus:ring-[#4A154B]/10 transition-all font-semibold"
          />
          <Search size={14} className="absolute left-3 top-3 text-[#1A1A1A]/40" />
        </div>
      </div>

      {/* Orders Grid Table */}
      <div className="ui-card overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#4A154B]/5 bg-[#FAF8F5]/50 text-[10px] uppercase font-bold text-[#1A1A1A]/50 tracking-wider">
                <th className="py-4 px-6">Order</th>
                <th className="py-4 px-6">Date</th>
                <th className="py-4 px-6">Customer</th>
                <th className="py-4 px-6 text-right">Revenue</th>
                <th className="py-4 px-6 text-center">Net Margin</th>
                <th className="py-4 px-6 text-center">Fulfillment</th>
                <th className="py-4 px-6 text-center">Carrier</th>
                <th className="py-4 px-6 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#4A154B]/5 text-xs">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#1A1A1A]/40 font-medium">
                    <Package size={32} className="mx-auto mb-2 opacity-30" />
                    No customer orders found matching your search.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const { totalRetail, marginPercent } = getOrderNetMargin(order);
                  const isPaid = order.displayFinancialStatus === "PAID";
                  
                  return (
                    <tr 
                      key={order.id} 
                      onClick={() => setSelectedOrder(order)}
                      className="hover:bg-[#FAF8F5]/30 transition-colors cursor-pointer group"
                    >
                      {/* Order name */}
                      <td className="py-4 px-6 font-bold text-[#4A154B] group-hover:text-[#D4AF37] transition-colors">
                        {order.name}
                      </td>
                      
                      {/* Date */}
                      <td className="py-4 px-6 text-[#1A1A1A]/60 font-semibold whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {new Date(order.createdAt).toLocaleDateString("en-IN", {
                            month: "short",
                            day: "numeric",
                            year: "numeric"
                          })}
                        </span>
                      </td>

                      {/* Customer Profile */}
                      <td className="py-4 px-6 font-semibold">
                        <div>
                          <p className="text-[#1A1A1A]">
                            {order.customer?.firstName} {order.customer?.lastName || "Customer"}
                          </p>
                          {order.shippingAddress?.city && (
                            <p className="text-[10px] text-[#1A1A1A]/40 flex items-center gap-0.5 mt-0.5">
                              <MapPin size={10} />
                              {order.shippingAddress.city}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Retail revenue */}
                      <td className="py-4 px-6 text-right font-display font-bold text-[#4A154B]">
                        <div>
                          <p>₹{totalRetail.toLocaleString("en-IN")}</p>
                          <span className={`inline-block text-[8px] font-bold uppercase rounded px-1 mt-0.5 ${
                            isPaid ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"
                          }`}>
                            {order.displayFinancialStatus}
                          </span>
                        </div>
                      </td>

                      {/* Calculated private net margins */}
                      <td className="py-4 px-6 text-center whitespace-nowrap">
                        <span className={`inline-block text-[10px] font-bold rounded-lg px-2.5 py-0.5 border ${getMarginColor(marginPercent)}`}>
                          +{Math.round(marginPercent)}% Margin
                        </span>
                      </td>

                      {/* Fulfillment/Delhivery */}
                      <td className="py-4 px-6 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                            order.displayFulfillmentStatus === "FULFILLED" 
                              ? "bg-green-50 text-green-700 border-green-200" 
                              : "bg-yellow-50 text-yellow-700 border-yellow-200"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              order.displayFulfillmentStatus === "FULFILLED" ? "bg-green-500" : "bg-yellow-500"
                            }`} />
                            {order.displayFulfillmentStatus === "FULFILLED" ? "Shipped" : "Processing"}
                          </span>

                          {(() => {
                            // Extract AWB
                            const awbAttribute = order.customAttributes?.find(
                              (attr: any) => attr.key.toLowerCase() === "awb" || attr.key.toLowerCase() === "trackingid"
                            );
                            let inlineAwb = awbAttribute ? awbAttribute.value : null;
                            if (!inlineAwb && order.note) {
                              const awbMatch = order.note.match(/AWB:\s*([^\s,]+)/i);
                              if (awbMatch) inlineAwb = awbMatch[1];
                            }

                            if (inlineAwb) {
                              return <LogisticsStatusBadge awb={inlineAwb} />;
                            }
                            return null;
                          })()}
                        </div>
                      </td>

                      {/* Carrier chosen by customer */}
                      <td className="py-4 px-6 text-center whitespace-nowrap">
                        {(() => {
                          const courierTag = order.tags?.find((tag: string) => tag.toLowerCase().startsWith("courier:"));
                          const courierName = courierTag ? courierTag.split(":")[1]?.trim() : "Delhivery";
                          return (
                            <span className={`inline-block text-[10px] font-bold rounded-lg px-2.5 py-0.5 border ${
                              courierName?.toLowerCase() === "shiprocket"
                                ? "text-rose-700 bg-rose-50 border-rose-200"
                                : "text-purple-700 bg-purple-50 border-purple-200"
                            }`}>
                              {courierName}
                            </span>
                          );
                        })()}
                      </td>

                      {/* View Action */}
                      <td className="py-4 px-6 text-center">
                        <button
                          type="button"
                          className="p-1.5 rounded-lg bg-[#4A154B]/5 hover:bg-[#4A154B]/10 text-[#4A154B] transition-all flex items-center justify-center mx-auto cursor-pointer"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dynamic Detailed Drawer Modal overlay */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          metaMap={metaMap}
          onClose={() => setSelectedOrder(null)}
        />
      )}

    </div>
  );
}

// Inline lazy-loaded dynamic tracking status component
import { useEffect as reactUseEffect } from "react";
function LogisticsStatusBadge({ awb }: { awb: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  reactUseEffect(() => {
    let active = true;
    fetch(`/api/orders/track?awb=${encodeURIComponent(awb)}`)
      .then((res) => res.json())
      .then((data) => {
        if (active && data?.ok && data?.tracking?.status) {
          setStatus(data.tracking.status);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [awb]);

  if (loading) {
    return <span className="text-[9px] text-[#1A1A1A]/40 animate-pulse">Checking status...</span>;
  }

  if (!status) {
    return <span className="text-[9px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded font-mono">No tracking</span>;
  }

  // Curated status styling matching modern design
  const getBadgeStyle = (s: string) => {
    const norm = s.toLowerCase();
    if (norm.includes("deliv")) return "bg-green-50 text-green-700 border-green-200";
    if (norm.includes("transit") || norm.includes("out for")) return "bg-blue-50 text-blue-700 border-blue-200";
    return "bg-[#D4AF37]/10 text-[#4A154B] border-[#D4AF37]/30";
  };

  return (
    <span className={`inline-block text-[9px] font-bold uppercase rounded px-1.5 py-0.5 border ${getBadgeStyle(status)}`}>
      {status}
    </span>
  );
}
