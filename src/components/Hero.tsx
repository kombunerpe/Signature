import React from 'react';
import { ArrowRight, MessageSquare } from 'lucide-react';

interface HeroProps {
  onOpenChat: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onOpenChat }) => {
  return (
    <section id="drop" className="relative overflow-hidden border-b border-[#0a0a0a]/10 bg-[#f4f2ee]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16 md:pt-16 md:pb-24 grid md:grid-cols-12 gap-8 items-end relative z-10">
        <div className="md:col-span-7">
          <div className="inline-block bg-[#0a0a0a] text-[#e9ff00] px-3 py-1 font-mono-code text-[11px] uppercase tracking-[0.25em] font-semibold rounded-sm mb-4">
            Drop 07 · Vol. II
          </div>
          <h1 className="font-display text-6xl sm:text-7xl md:text-8xl lg:text-9xl leading-[0.88] tracking-tight text-[#0a0a0a]">
            Berani<br />
            cepat.<br />
            <span className="text-[#ff5a1f]">Berani</span> beda.
          </h1>
          <p className="mt-6 max-w-lg text-[#0a0a0a]/80 text-base sm:text-lg font-sans-body leading-relaxed">
            Koleksi streetwear terkurasi untuk aksi kilat. Semua transaksi diverifikasi via email dan diproses instan melalui Nexus.
            <span className="block mt-1 font-mono-code text-xs text-[#0a0a0a]/60 font-medium">
            </span>
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#shop"
              data-testid="hero-shop-btn"
              className="bg-[#e9ff00] text-[#0a0a0a] hover:bg-[#d6f000] px-6 py-3.5 font-mono-code uppercase text-xs tracking-widest font-bold rounded flex items-center gap-2 transition-all hover:-translate-y-0.5 shadow-sm"
            >
              <span>Belanja Sekarang</span>
              <ArrowRight className="w-4 h-4" />
            </a>
            <button
              onClick={onOpenChat}
              data-testid="hero-chat-btn"
              className="border-2 border-[#0a0a0a] text-[#0a0a0a] hover:bg-[#0a0a0a] hover:text-[#f4f2ee] px-6 py-3.5 font-mono-code uppercase text-xs tracking-widest font-bold rounded flex items-center gap-2 transition-all"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Tanya CS</span>
            </button>
          </div>
        </div>

        <div className="md:col-span-5 relative mt-6 md:mt-0">
          <div className="aspect-[4/5] bg-[#0a0a0a] relative overflow-hidden rounded-md shadow-xl border border-[#0a0a0a]/20 group">
            <img
              alt="NEXUS Streetwear Editorial Lookbook"
              src="https://images.unsplash.com/photo-1520975916090-3105956dac38?auto=format&fit=crop&w=900&q=70"
              className="absolute inset-0 w-full h-full object-cover mix-blend-luminosity opacity-90 group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent opacity-80" />
            <div className="absolute bottom-4 left-4 right-4 flex justify-between font-mono-code text-xs text-[#f4f2ee] uppercase tracking-widest font-medium">
              <span className="bg-[#0a0a0a]/80 px-2 py-1 rounded backdrop-blur">Sku · NX/22</span>
              <span className="bg-[#0a0a0a]/80 px-2 py-1 rounded backdrop-blur text-[#e9ff00]">Lookbook / 07</span>
            </div>
          </div>
          <div className="font-mono-code text-[10px] uppercase tracking-widest text-[#0a0a0a]/50 mt-2 text-right">
            Photo: NEXUS Editorial 2026
          </div>
        </div>
      </div>
    </section>
  );
};
