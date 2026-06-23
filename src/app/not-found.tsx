import Link from "next/link";
import { ArrowLeft, Home, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
      {/* Visual Ornament */}
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-full border border-[#D4AF37]/30 flex items-center justify-center bg-white/40 shadow-inner">
          <Compass className="text-[#D4AF37] stroke-[1.25]" size={48} />
        </div>
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#4A154B] rounded-full border-2 border-[#FAF8F5]"></div>
      </div>

      {/* Text Section */}
      <h1 className="font-display font-extrabold text-4xl text-[#4A154B] tracking-tight">
        404
      </h1>
      <h2 className="font-display font-bold text-lg text-[#1A1A1A] mt-2 tracking-wide uppercase">
        Page Draped in Mystery
      </h2>
      <p className="text-sm text-[#1A1A1A]/60 mt-3 max-w-sm leading-relaxed">
        The saree, dashboard view, or resource you are looking for has slipped away gracefully or doesn't exist.
      </p>

      {/* Golden Elegant Divider */}
      <div className="w-16 h-[2px] bg-[#D4AF37] my-6 rounded-full"></div>

      {/* Call to Actions */}
      <div className="flex flex-col sm:flex-row gap-3 w-full">
        <Link 
          href="/" 
          className="btn-primary flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider py-3 w-full shadow-md no-underline"
        >
          <Home size={14} />
          Go to Dashboard
        </Link>
        <Link 
          href="/products" 
          className="btn-secondary flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider py-3 w-full no-underline"
        >
          <ArrowLeft size={14} />
          View Products
        </Link>
      </div>
    </div>
  );
}
