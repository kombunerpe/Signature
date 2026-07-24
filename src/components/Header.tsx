import React from 'react';
import { ShoppingBag, Database, ShoppingBag as StoreIcon } from 'lucide-react';

interface HeaderProps {
  cartCount: number;
  onOpenCart: () => void;
  activeView: 'store' | 'admin';
  onToggleView: (view: 'store' | 'admin') => void;
}

export const Header: React.FC<HeaderProps> = ({
  cartCount,
  onOpenCart,
  activeView,
  onToggleView
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#f4f2ee]/95 backdrop-blur border-b border-[#0a0a0a]/10">
      {/* Ticker banner */}
      <div className="bg-[#0a0a0a] text-[#f4f2ee] py-1.5 overflow-hidden border-b border-[#e9ff00]/20">
        <div className="marquee-animation whitespace-nowrap font-mono-code text-[11px] tracking-widest uppercase flex gap-10">
          <span>· SHIPPING DI ATAS RP 800K GIVE AWAY · UPDATE DROP BARU SETIAP SABTU · CHAT CS 24 JAM ·</span>
          <span>· SHIPPING DI ATAS RP 800K GIVE AWAY · UPDATE DROP BARU SETIAP SABTU · CHAT CS 24 JAM ·</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-6 sm:gap-8">
          <a
            href="#drop"
            onClick={(e) => {
              if (activeView === 'admin') {
                e.preventDefault();
                onToggleView('store');
              }
            }}
            className="flex items-baseline gap-2 group cursor-pointer"
            data-testid="brand-logo"
          >
            <span className="font-display text-3xl sm:text-4xl tracking-wider text-[#0a0a0a] group-hover:text-[#ff5a1f] transition-colors">
              NEXUS
            </span>
            <span className="font-mono-code text-[10px] uppercase text-[#0a0a0a]/60 font-semibold">
              est · store
            </span>
          </a>

          {/* Navigation links */}
          {activeView === 'store' && (
            <nav className="hidden md:flex items-center gap-6 font-mono-code text-xs uppercase tracking-widest text-[#0a0a0a]/80 font-medium">
              <a href="#drop" className="hover:text-[#ff5a1f] transition-colors">Drop</a>
              <a href="#shop" className="hover:text-[#ff5a1f] transition-colors">Shop</a>
              <a href="#about" className="hover:text-[#ff5a1f] transition-colors">About</a>
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* View switcher button */}
          <button
            onClick={() => onToggleView(activeView === 'store' ? 'admin' : 'store')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded text-xs font-mono-code uppercase tracking-wider font-semibold border transition-all ${
              activeView === 'admin'
                ? 'bg-[#e9ff00] text-[#0a0a0a] border-[#0a0a0a] shadow-sm'
                : 'bg-white text-[#0a0a0a] border-[#0a0a0a]/20 hover:border-[#0a0a0a]'
            }`}
            data-testid="toggle-admin-btn"
          >
            {activeView === 'store' ? (
              <>
                <Database className="w-3.5 h-3.5" />
                <span>Admin DB</span>
              </>
            ) : (
              <>
                <StoreIcon className="w-3.5 h-3.5" />
                <span>Lihat Store</span>
              </>
            )}
          </button>

          {/* Cart Button */}
          {activeView === 'store' && (
            <button
              onClick={onOpenCart}
              data-testid="open-cart-btn"
              className="relative bg-[#0a0a0a] text-[#f4f2ee] hover:bg-[#222222] px-3.5 py-2 font-mono-code text-xs uppercase tracking-widest rounded flex items-center gap-2 transition-all hover:-translate-y-0.5"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-[#e9ff00]" />
              <span>Cart</span>
              <span
                data-testid="cart-count"
                className="bg-[#e9ff00] text-[#0a0a0a] font-bold px-1.5 py-0.2 rounded text-[11px]"
              >
                {cartCount}
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
