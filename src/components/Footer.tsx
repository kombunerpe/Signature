import React from 'react';
import { Database, ShieldAlert } from 'lucide-react';

interface FooterProps {
  onToggleAdmin: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onToggleAdmin }) => {
  return (
    <footer className="bg-[#f4f2ee] border-t border-[#0a0a0a]/15 text-[#0a0a0a]">
      {/* About Section */}
      <section id="about" className="bg-[#0a0a0a] text-[#f4f2ee] py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid md:grid-cols-12 gap-8 items-start">
          <div className="md:col-span-5">
            <div className="font-mono-code text-xs uppercase tracking-[0.3em] text-[#e9ff00] font-semibold">
              TENTANG KAMI
            </div>
            <h2 className="font-display text-4xl sm:text-5xl md:text-6xl mt-2 tracking-wider text-white">
              NEXUS. Setiap keputusan.
            </h2>
          </div>
          <div className="md:col-span-7 space-y-4 text-neutral-300 font-sans-body leading-relaxed text-sm sm:text-base">
            <p>
              NEXUS membuat pakaian streetwear untuk mereka yang beraksi cepat dan tidak ragu. Potongan boxy, warna berani, dan material ramah aksi harian.
            </p>
            <div className="p-3.5 bg-neutral-900 border border-neutral-800 rounded-md font-mono-code text-xs text-[#e9ff00]/90 space-y-1">
              <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-white">
                <ShieldAlert className="w-4 h-4 text-[#e9ff00]" />
                <span>Teknologi Storage Browser</span>
              </div>
              <p className="text-neutral-400 font-normal">
                Data produk, transaksi pembayaran, dan komunikasi dengan Customer Service dikelola secara otomatis untuk memberikan pengalaman yang lebih praktis, cepat, dan nyaman.
                <b className="text-white">Build.by.Kmb</b> browser kamu.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <div className="font-display text-3xl tracking-wider text-[#0a0a0a]">
            NEXUS
          </div>
          <div className="font-mono-code text-xs text-[#0a0a0a]/60 mt-0.5">
            © {new Date().getFullYear()} · Streetwear Store · Jakarta / Bandung / Semarang / Online
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 font-mono-code text-xs uppercase tracking-widest font-semibold text-[#0a0a0a]">
          <a href="#shop" className="hover:text-[#ff5a1f] transition-colors">
            Shop
          </a>
          <a href="#drop" className="hover:text-[#ff5a1f] transition-colors">
            Drop
          </a>
          <button
            onClick={onToggleAdmin}
            data-testid="footer-admin-link"
            className="text-[#0a0a0a] hover:text-[#ff5a1f] underline flex items-center gap-1 font-bold"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Admin Panel</span>
          </button>
        </div>
      </div>
    </footer>
  );
};
