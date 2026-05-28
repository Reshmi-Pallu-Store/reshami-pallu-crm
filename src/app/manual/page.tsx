import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { 
  Sparkles, 
  Bookmark, 
  DollarSign, 
  Percent, 
  Video, 
  Layers, 
  FolderHeart, 
  UploadCloud, 
  AlertTriangle,
  Award
} from "lucide-react";

export default function ManualPage() {
  return (
    <div className="flex min-h-screen bg-[#FAF8F5]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Boutique Operations Manual" />
        
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 max-w-[1200px] mx-auto w-full space-y-8">
          
          {/* Welcome Banner */}
          <div className="bg-[#4A154B]/5 border border-[#4A154B]/10 rounded-2xl p-6 relative overflow-hidden backdrop-blur-md">
            <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-[#4A154B] opacity-5 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 rounded-full bg-[#D4AF37] opacity-5 blur-3xl" />
            
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#D4AF37] tracking-widest flex items-center gap-1.5 mb-1.5">
                  <Award size={12} />
                  Official Boutique Guide
                </span>
                <h3 className="font-display font-bold text-lg sm:text-xl text-[#4A154B] flex items-center gap-2">
                  Welcome to Your Operations Guide, Mrinalini!
                </h3>
                <p className="text-xs text-[#1A1A1A]/70 mt-1 max-w-[700px] leading-relaxed">
                  This interactive guide is integrated directly into your CRM workspace. It details saree catalog listings, dynamic custom selectors, short loop videos, collections curation, and mass upload utilities.
                </p>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-[#4A154B]/60 font-bold border border-[#4A154B]/10 rounded-md px-3 py-1.5 bg-white/40">
                Ver. 2.0 (May 2026)
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* 1. Saree Listings */}
            <div className="ui-card p-6 space-y-4">
              <h4 className="font-display font-bold text-base text-[#4A154B] border-b border-[#4A154B]/5 pb-3 flex items-center gap-2">
                <Bookmark size={18} className="text-[#D4AF37]" />
                1. Saree Descriptions &amp; SKUs
              </h4>
              <p className="text-xs text-[#1A1A1A]/75 leading-relaxed">
                When adding a new saree list, specify a detailed catalog title and a descriptive description detailing the fabric weight, pallu borders, and drapes feel.
              </p>
              
              <div className="bg-[#FAF8F5]/80 border border-[#4A154B]/5 rounded-xl p-4 space-y-2">
                <h5 className="text-[11px] font-bold uppercase text-[#4A154B] tracking-wider">Auto-Generated SKU Logic</h5>
                <p className="text-[11px] text-[#1A1A1A]/60 leading-relaxed">
                  SKUs are automatically constructed (e.g. <code className="font-mono bg-[#4A154B]/5 px-1 rounded text-[#4A154B] font-semibold">RP-BNR-RED-008</code>) by reading:
                </p>
                <ul className="text-[10px] text-[#1A1A1A]/70 space-y-1 list-disc list-inside">
                  <li><strong>Brand Code:</strong> <code className="font-mono text-[#4A154B]">RP</code> (Reshami Pallu)</li>
                  <li><strong>Region:</strong> 3-letter origin abbreviation (e.g. <code className="font-mono">BNR</code> for Banaras)</li>
                  <li><strong>Color Family:</strong> 3-letter color code (e.g. <code className="font-mono">RED</code> for Red)</li>
                  <li><strong>Auto-Increment:</strong> Sequential active stock counter prevents any SKU duplicate conflicts.</li>
                </ul>
              </div>
            </div>

            {/* 2. Pricing Matrix */}
            <div className="ui-card p-6 space-y-4">
              <h4 className="font-display font-bold text-base text-[#4A154B] border-b border-[#4A154B]/5 pb-3 flex items-center gap-2">
                <DollarSign size={18} className="text-[#D4AF37]" />
                2. Saree Pricing &amp; discounts
              </h4>
              <p className="text-xs text-[#1A1A1A]/75 leading-relaxed">
                Your boutique utilizes a robust pricing model supporting public selling tags, artificial discounts, and private base investments.
              </p>
              
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/50 border border-[#4A154B]/5 rounded-xl p-3">
                    <span className="text-[9px] uppercase font-bold text-[#1A1A1A]/40">Selling Price</span>
                    <p className="text-xs font-semibold text-[#4A154B] mt-0.5">The public price displayed to storefront shoppers.</p>
                  </div>
                  <div className="bg-white/50 border border-[#4A154B]/5 rounded-xl p-3">
                    <span className="text-[9px] uppercase font-bold text-[#1A1A1A]/40">Compare-at Price</span>
                    <p className="text-xs font-semibold text-[#4A154B] mt-0.5">A higher set price to show an artificial discount (e.g. 25,000 crossed out to 18,000).</p>
                  </div>
                </div>

                <div className="bg-[#FAF8F5]/80 border border-[#4A154B]/5 rounded-xl p-3.5 flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-green-600 shrink-0">
                    <Percent size={14} />
                  </div>
                  <div>
                    <h5 className="text-[11px] font-bold uppercase text-[#4A154B] tracking-wider">Private Cost Price &amp; Margin</h5>
                    <p className="text-[10px] text-[#1A1A1A]/60 leading-relaxed mt-0.5">
                      Your direct cost price is stored strictly in Upstash Redis, completely hidden from storefront search crawlers. Profit margins are calculated and styled automatically (Green &gt;= 40% margin, Yellow 20%-39% margin, Red &lt; 20% margin).
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Dynamic Other Selectors */}
            <div className="ui-card p-6 space-y-4">
              <h4 className="font-display font-bold text-base text-[#4A154B] border-b border-[#4A154B]/5 pb-3 flex items-center gap-2">
                <Layers size={18} className="text-[#D4AF37]" />
                3. Custom "Other" selectors
              </h4>
              <p className="text-xs text-[#1A1A1A]/75 leading-relaxed">
                Region of Origin, Fabric Type, Weave Style, Occasion Curation, and Color Family dropdown selectors are dynamic and persistent.
              </p>
              
              <div className="bg-[#FAF8F5]/80 border border-[#4A154B]/5 rounded-xl p-4 space-y-3">
                <div className="flex gap-2.5 items-start text-[11px]">
                  <span className="w-5 h-5 rounded-full bg-[#4A154B] text-white flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5">1</span>
                  <p className="text-[#1A1A1A]/70 leading-relaxed">Select <strong>Other</strong> inside any of the specification dropdowns.</p>
                </div>
                <div className="flex gap-2.5 items-start text-[11px]">
                  <span className="w-5 h-5 rounded-full bg-[#4A154B] text-white flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5">2</span>
                  <p className="text-[#1A1A1A]/70 leading-relaxed">A custom text input field will **immediately pop open** below it. Type in your custom attribute name (e.g. <span className="font-semibold">Bhagalpur</span> or <span className="font-semibold">Tussar Silk</span>).</p>
                </div>
                <div className="flex gap-2.5 items-start text-[11px]">
                  <span className="w-5 h-5 rounded-full bg-[#4A154B] text-white flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5">3</span>
                  <p className="text-[#1A1A1A]/70 leading-relaxed">Save the product. The CRM writes this custom option to Redis. It will appear as a <strong>selectable dropdown option by default</strong> on your very next addition!</p>
                </div>
              </div>
            </div>

            {/* 4. Short Video Assets */}
            <div className="ui-card p-6 space-y-4">
              <h4 className="font-display font-bold text-base text-[#4A154B] border-b border-[#4A154B]/5 pb-3 flex items-center gap-2">
                <Video size={18} className="text-[#D4AF37]" />
                4. Vertical short loop videos
              </h4>
              <p className="text-xs text-[#1A1A1A]/75 leading-relaxed">
                Add vertical drapes videos at the bottom of the saree catalog page. The uploader handles multi-part CDN stages to Shopify's file system automatically.
              </p>
              
              <div className="bg-[#D4AF37]/5 border border-[#D4AF37]/20 rounded-xl p-4 space-y-3">
                <h5 className="text-[11px] font-bold uppercase text-[#4A154B] tracking-wider flex items-center gap-1.5">
                  <Sparkles size={12} className="text-[#D4AF37]" />
                  Vertical Video Specifications
                </h5>
                <ul className="text-[10px] text-[#1A1A1A]/75 space-y-1.5 leading-relaxed">
                  <li>🎥 <strong>Aspect Ratio:</strong> Vertical 9:16 or 2:3 ratio (e.g. 1080 x 1920 px).</li>
                  <li>⏱️ <strong>Length:</strong> 5 to 15 seconds maximum.</li>
                  <li>🔇 <strong>Audio:</strong> Must be completely silent or muted.</li>
                  <li>📁 <strong>File Size:</strong> Under 10 MB per video for instant storefront looping.</li>
                  <li>✨ <strong>Founder's Exclusive Slider:</strong> Checking the "Founder's Exclusive" checkbox tags the saree listing <code className="font-mono bg-[#4A154B]/10 px-1 rounded text-[#4A154B] text-[8px] font-bold">Founders-Exclusive</code> and pushes the loop video directly onto the home page exclusive slider!</li>
                </ul>
              </div>
            </div>

            {/* 5. Smart Collections */}
            <div className="ui-card p-6 space-y-4">
              <h4 className="font-display font-bold text-base text-[#4A154B] border-b border-[#4A154B]/5 pb-3 flex items-center gap-2">
                <FolderHeart size={18} className="text-[#D4AF37]" />
                5. Storefront collections
              </h4>
              <p className="text-xs text-[#1A1A1A]/75 leading-relaxed">
                Storefront categories are smart collections created programmatically on Shopify Admin from the Collections page (`/collections`).
              </p>
              <div className="bg-[#FAF8F5]/80 border border-[#4A154B]/5 rounded-xl p-4 flex gap-3 items-start">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                  <FolderHeart size={14} />
                </div>
                <div>
                  <h5 className="text-[11px] font-bold uppercase text-[#4A154B] tracking-wider">Automated Pool Tags</h5>
                  <p className="text-[10px] text-[#1A1A1A]/60 leading-relaxed mt-0.5">
                    To group sarees into collections, set tag matching rules in the collection creator. For example, setting the tag filter rule to "Banaras" means any saree containing the storefront tag "Banaras" is pooled into that collection page automatically!
                  </p>
                </div>
              </div>
            </div>

            {/* 6. Bulk CSV Synchronization */}
            <div className="ui-card p-6 space-y-4">
              <h4 className="font-display font-bold text-base text-[#4A154B] border-b border-[#4A154B]/5 pb-3 flex items-center gap-2">
                <UploadCloud size={18} className="text-[#D4AF37]" />
                6. Bulk spreadsheet syncing
              </h4>
              <p className="text-xs text-[#1A1A1A]/75 leading-relaxed">
                For rapid inventory management, compile a saree spreadsheet sheet to upload and sync dozens of catalog listings simultaneously.
              </p>
              
              <div className="bg-[#FAF8F5]/80 border border-[#4A154B]/5 rounded-xl p-4 flex gap-3 items-start">
                <div className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#4A154B]/10 flex items-center justify-center text-[#4A154B] shrink-0">
                  <UploadCloud size={14} />
                </div>
                <div className="text-[10px] text-[#1A1A1A]/60 leading-relaxed space-y-1">
                  <p className="font-semibold text-[#4A154B]">Synchronize Steps:</p>
                  <p>1. Download the structured template CSV file on the Bulk Upload page.</p>
                  <p>2. Fill in all details in your spreadsheet application (Excel, Google Sheets).</p>
                  <p>3. Drop the file inside the upload box. The CSV parser validates header fields and schedules push streams sequential runs.</p>
                </div>
              </div>
            </div>

          </div>

          {/* Quick Help Footer */}
          <div className="ui-card p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/40 border border-amber-200/50 bg-amber-50/10">
            <div className="flex gap-3 items-start">
              <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h5 className="text-xs font-bold text-[#4A154B]">Need Custom System Changes?</h5>
                <p className="text-[11px] text-[#1A1A1A]/60 mt-0.5">Please contact fluxenta developer support to schedule private token resets or Upstash Redis database changes.</p>
              </div>
            </div>
            <div className="text-[10px] font-mono text-[#1A1A1A]/50 bg-white/50 border border-[#4A154B]/5 rounded px-2.5 py-1">
              SUPPORT_REF: FP-CRM-2026-MRN
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
