"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { 
  UploadCloud, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertTriangle, 
  ArrowRight,
  TrendingUp,
  Download
} from "lucide-react";

// CSV Template Headers
const TEMPLATE_HEADERS = [
  "Title",
  "Description",
  "Status",
  "Price",
  "CostPrice",
  "Stock",
  "SKU",
  "Tags",
  "Fabric",
  "Weave",
  "ColorFamily",
  "Occasion",
  "Region",
  "BlouseIncluded",
  "BlouseLength",
  "WashCare",
  "FoundersExclusive",
  "PrivateNotes"
];

const SAMPLE_ROW = [
  "Handwoven Banarasi Katan Silk Saree",
  "Exquisite handloom Banarasi saree in pure katan silk with intricate gold zari weave.",
  "DRAFT",
  "18500",
  "11000",
  "5",
  "RP-BNR-RED-001",
  "Banarasi, Silk, Zari",
  "Pure Katan Silk",
  "Kadhua",
  "Red",
  "Bridal",
  "Banaras",
  "TRUE",
  "0.8 meters",
  "Dry Clean Only",
  "TRUE",
  "Procured from weaver Ramlal in Varanasi."
];

export default function BulkUploadPage() {
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusLog, setStatusLog] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);

  // Helper to generate and download the CSV template
  const downloadTemplate = () => {
    const csvContent = [
      TEMPLATE_HEADERS.join(","),
      SAMPLE_ROW.map(val => `"${val.replace(/"/g, '""')}"`).join(",")
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "reshami_pallu_saree_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Client-side CSV Parser
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  const parseCSV = (text: string) => {
    try {
      const lines: string[] = [];
      let currentLine = "";
      let inQuotes = false;

      // Handle quotes with commas correctly
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === '\n' && !inQuotes) {
          lines.push(currentLine);
          currentLine = "";
        } else {
          currentLine += char;
        }
      }
      if (currentLine) lines.push(currentLine);

      if (lines.length < 2) {
        alert("CSV is empty or missing data rows");
        return;
      }

      // Parse headers
      const parsedHeaders = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
      
      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Parse row values taking care of double quotes
        const values: string[] = [];
        let curVal = "";
        let insideQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            insideQuotes = !insideQuotes;
          } else if (char === ',' && !insideQuotes) {
            values.push(curVal.trim().replace(/^"|"$/g, ""));
            curVal = "";
          } else {
            curVal += char;
          }
        }
        values.push(curVal.trim().replace(/^"|"$/g, ""));

        // Map values to keys
        const item: any = {};
        parsedHeaders.forEach((header, idx) => {
          item[header] = values[idx] || "";
        });

        // Skip rows without SKU or Title
        if (!item.SKU || !item.Title) continue;

        rows.push({
          title: item.Title,
          description: item.Description || "",
          status: item.Status === "ACTIVE" ? "ACTIVE" : "DRAFT",
          price: parseFloat(item.Price) || 0,
          costPrice: parseFloat(item.CostPrice) || 0,
          stock: parseInt(item.Stock) || 0,
          sku: item.SKU,
          tags: item.Tags ? item.Tags.split(";").map((t: string) => t.trim()) : [],
          fabric: item.Fabric || "Pure Silk",
          weave: item.Weave || "Kadhua",
          colorFamily: item.ColorFamily || "Red",
          occasion: item.Occasion || "Bridal",
          region: item.Region || "Banaras",
          blouseIncluded: item.BlouseIncluded?.toUpperCase() === "TRUE",
          blouseLength: item.BlouseLength || "0.8 meters",
          washCare: item.WashCare || "Dry Clean Only",
          foundersExclusive: item.FoundersExclusive?.toUpperCase() === "TRUE",
          privateNotes: item.PrivateNotes || ""
        });
      }

      setParsedRows(rows);
      setStatusLog([`✓ Successfully parsed ${rows.length} sarees from CSV. Ready for catalog push!`]);
    } catch (err) {
      alert("Failed to parse CSV: " + (err as Error).message);
    }
  };

  // Pushing parsed items sequentially
  const startBulkUpload = async () => {
    if (parsedRows.length === 0) return;
    setUploading(true);
    setProgress(0);
    setSuccess(false);

    const logs: string[] = [];
    
    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      logs.push(`⏳ [${i + 1}/${parsedRows.length}] Publishing SKU ${row.sku}: ${row.title}...`);
      setStatusLog([...logs]);

      try {
        const payload = {
          title: row.title,
          descriptionHtml: `<p>${row.description.replace(/\n/g, "<br />")}</p>`,
          status: row.status,
          price: row.price,
          costPrice: row.costPrice,
          stock: row.stock,
          sku: row.sku,
          tags: row.tags,
          metafields: {
            fabric: row.fabric,
            weave: row.weave,
            colorFamily: row.colorFamily,
            occasion: row.occasion,
            region: row.region,
            blouseIncluded: row.blouseIncluded,
            blouseLength: row.blouseLength,
            washCare: row.washCare,
            foundersExclusive: row.foundersExclusive
          },
          privateNotes: row.privateNotes
        };

        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Pushed failed");
        }

        logs[logs.length - 1] = `✅ [${i + 1}/${parsedRows.length}] Successfully created Saree: ${row.sku}`;
      } catch (err) {
        logs[logs.length - 1] = `❌ [${i + 1}/${parsedRows.length}] Failed to create Saree ${row.sku}: ${(err as Error).message}`;
      }

      setStatusLog([...logs]);
      setProgress(Math.round(((i + 1) / parsedRows.length) * 100));
    }

    setUploading(false);
    setSuccess(true);
    setParsedRows([]);
  };

  return (
    <div className="flex min-h-screen bg-[#FAF8F5]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Bulk Saree Upload" />

        <main className="flex-1 overflow-y-auto p-4 sm:p-8 max-w-[1000px] mx-auto w-full space-y-6 sm:space-y-8">
          
          {/* Instructions and Download Template Card */}
          <div className="ui-card p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/40">
            <div>
              <h3 className="font-display font-bold text-base text-[#4A154B] flex items-center gap-2">
                <FileSpreadsheet size={18} className="text-[#D4AF37]" />
                Download CSV Template
              </h3>
              <p className="text-xs text-[#1A1A1A]/60 mt-1">
                Download the structured CSV template containing all 26 schema details for mass inventory uploads.
              </p>
            </div>
            
            <button
              onClick={downloadTemplate}
              className="btn-secondary flex items-center gap-1.5 py-2 px-5 text-xs uppercase tracking-wider font-semibold"
            >
              <Download size={14} />
              CSV Template
            </button>
          </div>

          {/* Drag & Drop Upload Zone */}
          <div className="ui-card p-8 flex flex-col items-center justify-center border-dashed border-[#4A154B]/20 text-center relative bg-[#FAF8F5]/30">
            <UploadCloud size={40} className="text-[#4A154B]/50 mb-3" />
            <h4 className="text-[#4A154B] font-display font-bold text-sm">Upload Finished Inventory CSV</h4>
            <p className="text-xs text-[#1A1A1A]/50 mt-1 mb-6">Select your compiled CSV file. We will instantly parse and validate all 26 saree attributes.</p>
            
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              disabled={uploading}
            />
          </div>

          {/* Parsing progress & log outputs */}
          {statusLog.length > 0 && (
            <div className="ui-card p-6 space-y-4">
              <h4 className="font-display font-bold text-sm text-[#4A154B]">
                Upload Process Monitor
              </h4>
              
              {/* Progress bar */}
              {uploading && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-[#4A154B] font-bold">
                    <span>Synchronizing Catalog...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-[#4A154B]/5 rounded-full overflow-hidden border border-[#4A154B]/10">
                    <div className="h-full bg-[#4A154B] transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}

              {/* Console log outputs */}
              <div className="h-48 overflow-y-auto bg-[#1A1A1A] rounded-xl p-4 font-mono text-[10px] text-green-400 space-y-1">
                {statusLog.map((log, idx) => (
                  <div key={idx}>{log}</div>
                ))}
              </div>

              {/* Action push button */}
              {parsedRows.length > 0 && !uploading && (
                <div className="flex justify-end">
                  <button
                    onClick={startBulkUpload}
                    className="btn-primary py-2.5 px-6 text-xs uppercase tracking-wider font-semibold flex items-center gap-1.5 shadow-md"
                  >
                    <span>Push {parsedRows.length} Sarees Live</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 p-4 rounded-xl text-green-700 text-xs font-bold">
                  <CheckCircle size={16} />
                  <span>Success! Catalog sync is complete. Your inventory is now 100% updated.</span>
                </div>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
