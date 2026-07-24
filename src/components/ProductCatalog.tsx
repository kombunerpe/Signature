import React, { useState, useEffect, useMemo } from 'react';
import { Product } from '../types';
import {
  Plus, Search, Tag, Check, ZoomIn, ZoomOut, X, ChevronLeft, ChevronRight,
  Ruler, Truck, Sun, Moon, Palette, ShoppingBag, Star, MapPin, Sparkles,
  ArrowUpDown, Filter, Layers, RefreshCw, ExternalLink
} from 'lucide-react';

interface ProductCatalogProps {
  products: Product[];
  onAddToCart: (id: string, size?: string) => void;
}

const CATEGORY_LIST = [
  { name: 'Semua Kategori', icon: '🌟' },
  { name: 'Handphone & Gadget', icon: '📱' },
  { name: 'Elektronik & TV', icon: '📺' },
  { name: 'Otomotif & Aksesoris Motor', icon: '🏍️' },
  { name: 'Komputer & Gaming', icon: '💻' },
  { name: 'T-Shirt & Kaos', icon: '👕' },
  { name: 'Hoodie & Outerwear', icon: '🧥' },
  { name: 'Celana & Denim', icon: '👖' },
  { name: 'Sepatu & Sneakers', icon: '👟' },
  { name: 'Rumah Tangga & Dapur', icon: '🏠' },
  { name: 'Kecantikan & Kesehatan', icon: '💄' },
  { name: 'Topi & Aksesoris', icon: '🧢' },
];

const PLATFORM_LIST = ['Semua Platform', 'Tokopedia', 'Shopee', 'Official Store'];

const DEFAULT_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

export const ProductCatalog: React.FC<ProductCatalogProps> = ({ products, onAddToCart }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua Kategori');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('Semua Platform');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'popular' | 'price-asc' | 'price-desc' | 'rating'>('popular');
  const [viewMode, setViewMode] = useState<'grouped' | 'grid'>('grouped');

  // Online marketplace AI search items merged with local catalog
  const [liveOnlineProducts, setLiveOnlineProducts] = useState<Product[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState<boolean>(false);
  const [onlineSearchError, setOnlineSearchError] = useState<string | null>(null);

  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({});
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({});
  const [zoomedIndex, setZoomedIndex] = useState<number | null>(null);
  const [activeImgIndex, setActiveImgIndex] = useState<number>(0);
  const [isExtraZoomed, setIsExtraZoomed] = useState<boolean>(false);
  const [zoomBgMode, setZoomBgMode] = useState<'soft-light' | 'white' | 'dark'>('soft-light');

  // Combined product list (local + fetched online marketplace items)
  const allCatalogProducts = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => map.set(p.id, p));
    liveOnlineProducts.forEach((p) => map.set(p.id, p));
    return Array.from(map.values());
  }, [products, liveOnlineProducts]);

  // Trigger online marketplace AI search via Express backend
  const handleTriggerOnlineSearch = async (queryText?: string) => {
    const q = queryText !== undefined ? queryText : searchQuery;
    setIsSearchingOnline(true);
    setOnlineSearchError(null);

    try {
      const res = await fetch('/api/marketplace-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q || selectedCategory,
          category: selectedCategory === 'Semua Kategori' ? '' : selectedCategory,
          platform: selectedPlatform
        })
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.products)) {
        setLiveOnlineProducts(data.products);
      } else {
        setOnlineSearchError('Gagal mengambil data database Tokopedia/Shopee');
      }
    } catch (err: any) {
      console.error('Failed to query marketplace DB:', err);
      setOnlineSearchError('Terjadi gangguan jaringan saat pencarian online');
    } finally {
      setIsSearchingOnline(false);
    }
  };

  // Filtered & Sorted Products
  const filteredProducts = useMemo(() => {
    return allCatalogProducts
      .filter((p) => {
        // Category filter
        const matchesCategory =
          selectedCategory === 'Semua Kategori' ||
          p.category === selectedCategory ||
          (p.tag && p.tag.toLowerCase() === selectedCategory.toLowerCase());

        // Platform filter
        const matchesPlatform =
          selectedPlatform === 'Semua Platform' ||
          p.seller_platform === selectedPlatform ||
          (selectedPlatform === 'Official Store' && p.seller_platform?.includes('Official'));

        // Search text
        const q = searchQuery.trim().toLowerCase();
        const matchesSearch =
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.tag?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          p.seller_name?.toLowerCase().includes(q) ||
          p.location?.toLowerCase().includes(q);

        return matchesCategory && matchesPlatform && matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return a.price - b.price;
        if (sortBy === 'price-desc') return b.price - a.price;
        if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
        // default: popular (sold count)
        return (b.sold_count || 0) - (a.sold_count || 0);
      });
  }, [allCatalogProducts, selectedCategory, selectedPlatform, searchQuery, sortBy]);

  // Group products by category for 'grouped' view mode
  const categoryGroups = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    filteredProducts.forEach((p) => {
      const catName = p.category || 'Lainnya';
      if (!groups[catName]) groups[catName] = [];
      groups[catName].push(p);
    });
    return groups;
  }, [filteredProducts]);

  const getProductSize = (p: Product) => {
    if (selectedSizes[p.id]) return selectedSizes[p.id];
    if (p.sizes && p.sizes.length > 0) return p.sizes[0];
    return 'L';
  };

  const handleSelectSize = (id: string, size: string) => {
    setSelectedSizes((prev) => ({ ...prev, [id]: size }));
  };

  const handleAdd = (p: Product) => {
    const size = getProductSize(p);
    onAddToCart(p.id, size);
    setAddedIds((prev) => ({ ...prev, [p.id]: true }));
    setTimeout(() => {
      setAddedIds((prev) => ({ ...prev, [p.id]: false }));
    }, 1200);
  };

  const fmtIDR = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');

  // Keyboard navigation for zoomed image modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (zoomedIndex === null) return;
      if (e.key === 'Escape') {
        setZoomedIndex(null);
        setIsExtraZoomed(false);
      } else if (e.key === 'ArrowLeft') {
        setZoomedIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : filteredProducts.length - 1));
        setIsExtraZoomed(false);
      } else if (e.key === 'ArrowRight') {
        setZoomedIndex((prev) => (prev !== null && prev < filteredProducts.length - 1 ? prev + 1 : 0));
        setIsExtraZoomed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomedIndex, filteredProducts.length]);

  const activeZoomProduct = zoomedIndex !== null ? filteredProducts[zoomedIndex] : null;

  return (
    <section id="shop" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      {/* Header Title */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 border-b border-[#0a0a0a]/10 pb-6">
        <div>
          <div className="flex items-center gap-2 font-mono-code text-xs uppercase tracking-[0.25em] text-[#ff5a1f] font-bold">
            <Sparkles className="w-4 h-4 text-[#ff5a1f]" />
            <span>KATALOG DATABASE TOKOPEDIA & SHOPEE</span>
          </div>
          <h2 className="font-display text-4xl sm:text-5xl md:text-6xl mt-1 text-[#0a0a0a] leading-none">
            Semua Kategori Produk Marketplace.
          </h2>
          <p className="text-xs sm:text-sm font-sans-body text-[#0a0a0a]/70 mt-2 max-w-xl">
            Lengkap dari Handphone & Gadget, Elektronik & TV, Aksesoris Motor & Helm, Fashion & Streetwear, Komputer Gaming, hingga Rumah Tangga & Skincare Tokopedia & Shopee.
          </p>
        </div>

        {/* Live Search Box & Online Sync Trigger */}
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
          <div className="relative min-w-[280px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0a0a0a]/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTriggerOnlineSearch();
              }}
              placeholder="Cari nama, brand, ukuran..."
              className="w-full bg-white border border-[#0a0a0a]/20 rounded-md pl-10 pr-3 py-2.5 text-sm font-sans-body focus:outline-none focus:border-[#0a0a0a] focus:ring-1 focus:ring-[#0a0a0a] shadow-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0a0a0a]/40 hover:text-[#0a0a0a]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleTriggerOnlineSearch()}
            disabled={isSearchingOnline}
            className="px-4 py-2.5 bg-[#0a0a0a] hover:bg-[#ff5a1f] text-[#e9ff00] font-mono-code text-xs uppercase tracking-wider font-bold rounded-md flex items-center justify-center gap-2 transition-all shadow cursor-pointer disabled:opacity-60"
            title="Cari produk langsung ke database online Tokopedia/Shopee"
          >
            {isSearchingOnline ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-[#e9ff00]" />
                <span>Mencari DB...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-[#e9ff00]" />
                <span>Cari Online DB</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* CATEGORY SELECTOR CARDS (KELOMPOK KATEGORI) */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono-code text-xs uppercase tracking-widest text-[#0a0a0a]/70 font-semibold flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[#ff5a1f]" />
            <span>Pilih Kelompok Kategori Barang:</span>
          </span>
          <span className="font-mono-code text-xs text-[#0a0a0a]/50 font-medium">
            {filteredProducts.length} Item Ditemukan
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {CATEGORY_LIST.map((cat) => {
            const isSelected = selectedCategory === cat.name;
            const count = cat.name === 'Semua Kategori'
              ? allCatalogProducts.length
              : allCatalogProducts.filter((p) => p.category === cat.name || p.tag === cat.name).length;

            return (
              <button
                key={cat.name}
                type="button"
                onClick={() => setSelectedCategory(cat.name)}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden ${
                  isSelected
                    ? 'bg-[#0a0a0a] text-[#e9ff00] border-[#0a0a0a] shadow-md ring-2 ring-[#e9ff00]/40'
                    : 'bg-white text-[#0a0a0a] border-[#0a0a0a]/15 hover:border-[#0a0a0a] hover:shadow-sm'
                }`}
              >
                <div className="text-xl mb-1">{cat.icon}</div>
                <div>
                  <div className={`font-mono-code text-xs font-bold leading-tight ${isSelected ? 'text-[#e9ff00]' : 'text-[#0a0a0a]'}`}>
                    {cat.name}
                  </div>
                  <div className={`font-mono-code text-[10px] mt-0.5 ${isSelected ? 'text-neutral-400' : 'text-[#0a0a0a]/50'}`}>
                    {count} item
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* FILTER & SORT TOOLBAR */}
      <div className="bg-white border border-[#0a0a0a]/15 rounded-lg p-4 mb-8 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 shadow-sm">
        {/* Platform Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none font-mono-code text-xs">
          <span className="text-[#0a0a0a]/50 uppercase font-semibold mr-1 text-[11px] hidden sm:inline">
            Platform:
          </span>
          {PLATFORM_LIST.map((plat) => {
            const isSel = selectedPlatform === plat;
            return (
              <button
                key={plat}
                type="button"
                onClick={() => setSelectedPlatform(plat)}
                className={`px-3 py-1.5 rounded font-bold whitespace-nowrap transition-all cursor-pointer border ${
                  isSel
                    ? plat === 'Tokopedia'
                      ? 'bg-[#00aa5b] text-white border-[#00aa5b]'
                      : plat === 'Shopee'
                      ? 'bg-[#ee4d2d] text-white border-[#ee4d2d]'
                      : 'bg-[#0a0a0a] text-[#e9ff00] border-[#0a0a0a]'
                    : 'bg-neutral-100 text-[#0a0a0a]/80 border-transparent hover:border-[#0a0a0a]/30'
                }`}
              >
                {plat === 'Tokopedia' && '🟢 '}
                {plat === 'Shopee' && '🟠 '}
                {plat}
              </button>
            );
          })}
        </div>

        {/* View Mode & Sort Controls */}
        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 font-mono-code text-xs">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-neutral-100 p-1 rounded border border-[#0a0a0a]/10">
            <button
              type="button"
              onClick={() => setViewMode('grouped')}
              className={`px-2.5 py-1 rounded font-bold flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'grouped'
                  ? 'bg-[#0a0a0a] text-[#e9ff00] shadow'
                  : 'text-[#0a0a0a]/70 hover:text-[#0a0a0a]'
              }`}
              title="Tampilkan Berdasarkan Kelompok Kategori"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Per Kategori</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1 rounded font-bold flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-[#0a0a0a] text-[#e9ff00] shadow'
                  : 'text-[#0a0a0a]/70 hover:text-[#0a0a0a]'
              }`}
              title="Tampilkan Grid Semua Item"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Semua Grid</span>
            </button>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#0a0a0a]/50" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-neutral-100 border border-[#0a0a0a]/20 rounded px-2.5 py-1.5 font-bold text-xs focus:outline-none focus:border-[#0a0a0a] cursor-pointer"
            >
              <option value="popular">Urutkan: Terpopuler (Terjual)</option>
              <option value="rating">Urutkan: Rating Tertinggi</option>
              <option value="price-asc">Urutkan: Harga Terendah</option>
              <option value="price-desc">Urutkan: Harga Tertinggi</option>
            </select>
          </div>
        </div>
      </div>

      {/* Online Search Notification / Error Banner */}
      {onlineSearchError && (
        <div className="mb-6 p-3 bg-red-100 border border-red-300 rounded text-xs font-mono-code text-red-800 flex items-center justify-between">
          <span>{onlineSearchError}</span>
          <button onClick={() => setOnlineSearchError(null)} className="underline">
            Tutup
          </button>
        </div>
      )}

      {liveOnlineProducts.length > 0 && (
        <div className="mb-6 p-3.5 bg-[#e9ff00]/20 border border-[#0a0a0a] rounded-md font-mono-code text-xs text-[#0a0a0a] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#ff5a1f]" />
            <span>
              Menampilkan <b>{liveOnlineProducts.length} produk tambahan</b> dari hasil pencarian database Tokopedia & Shopee.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setLiveOnlineProducts([])}
            className="text-[11px] uppercase tracking-wider font-bold underline hover:text-[#ff5a1f]"
          >
            Reset Hasil Online
          </button>
        </div>
      )}

      {/* NO RESULTS STATE */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white border border-[#0a0a0a]/15 rounded-lg p-12 text-center my-8 shadow-sm">
          <Tag className="w-10 h-10 text-[#0a0a0a]/20 mx-auto mb-3" />
          <h3 className="font-display text-2xl text-[#0a0a0a]">
            Item Tidak Ditemukan
          </h3>
          <p className="font-mono-code text-xs text-[#0a0a0a]/60 uppercase tracking-wider mt-1 max-w-md mx-auto">
            Tidak ada produk yang cocok dengan kategori "{selectedCategory}" atau pencarian "{searchQuery}"
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('Semua Kategori');
                setSelectedPlatform('Semua Platform');
                setSearchQuery('');
              }}
              className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-[#0a0a0a] border border-[#0a0a0a]/20 rounded font-mono-code text-xs font-bold"
            >
              Reset Semua Filter
            </button>
            <button
              type="button"
              onClick={() => handleTriggerOnlineSearch()}
              className="px-4 py-2 bg-[#0a0a0a] text-[#e9ff00] rounded font-mono-code text-xs font-bold flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Cari di Tokopedia/Shopee DB</span>
            </button>
          </div>
        </div>
      ) : viewMode === 'grouped' ? (
        /* VIEW MODE 1: KELOMPOK PER KATEGORI */
        <div className="space-y-12">
          {(Object.entries(categoryGroups) as [string, Product[]][]).map(([catName, catProducts]) => (
            <div key={catName} className="border-t border-[#0a0a0a]/15 pt-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <span className="font-mono-code text-[11px] uppercase tracking-widest text-[#ff5a1f] font-bold">
                    Kategori Barang
                  </span>
                  <h3 className="font-display text-3xl sm:text-4xl text-[#0a0a0a]">
                    {catName}
                  </h3>
                </div>
                <div className="font-mono-code text-xs text-[#0a0a0a]/60 font-semibold bg-white border border-[#0a0a0a]/15 px-3 py-1 rounded">
                  {catProducts.length} Items
                </div>
              </div>

              {/* Grid for category group */}
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {catProducts.map((p) => {
                  const idx = filteredProducts.findIndex((item) => item.id === p.id);
                  return renderProductCard(p, idx);
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* VIEW MODE 2: UNIFIED GRID */
        <div
          data-testid="product-grid"
          className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6"
        >
          {filteredProducts.map((p, idx) => renderProductCard(p, idx))}
        </div>
      )}

      {/* LIGHTBOX / DETAIL MODAL */}
      {activeZoomProduct && renderDetailModal(activeZoomProduct)}
    </section>
  );

  /* RENDER SINGLE PRODUCT CARD COMPONENT */
  function renderProductCard(p: Product, idx: number) {
    const isJustAdded = addedIds[p.id];
    const currentSize = getProductSize(p);

    // Calculate discount percentage if original_price exists
    const discountPct = p.original_price && p.original_price > p.price
      ? Math.round(((p.original_price - p.price) / p.original_price) * 100)
      : null;

    // Available size options array
    const availableSizes = p.sizes && p.sizes.length > 0 ? p.sizes : DEFAULT_SIZES;

    return (
      <article
        key={p.id}
        data-testid={`product-card-${p.id}`}
        className="bg-white rounded-lg overflow-hidden border border-[#0a0a0a]/15 flex flex-col group hover:border-[#0a0a0a] transition-all hover:shadow-xl relative"
      >
        {/* Marketplace Platform Badge */}
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 items-start pointer-events-none">
          {p.seller_platform === 'Tokopedia' && (
            <span className="bg-[#00aa5b] text-white font-mono-code text-[10px] uppercase font-bold px-2 py-0.5 rounded shadow-sm flex items-center gap-1">
              🟢 Tokopedia
            </span>
          )}
          {p.seller_platform === 'Shopee' && (
            <span className="bg-[#ee4d2d] text-white font-mono-code text-[10px] uppercase font-bold px-2 py-0.5 rounded shadow-sm flex items-center gap-1">
              🟠 Shopee
            </span>
          )}
          {(!p.seller_platform || p.seller_platform === 'Official Store' || p.seller_platform === 'NEXUS Mall') && (
            <span className="bg-[#0a0a0a] text-[#e9ff00] border border-[#e9ff00]/40 font-mono-code text-[10px] uppercase font-bold px-2 py-0.5 rounded shadow-sm">
              ⚡ NEXUS Mall
            </span>
          )}
        </div>

        {/* Discount Badge */}
        {discountPct && (
          <div className="absolute top-2 right-2 z-10 bg-[#ff5a1f] text-white font-mono-code text-[10px] font-extrabold px-1.5 py-0.5 rounded shadow-sm pointer-events-none">
            -{discountPct}%
          </div>
        )}

        {/* Clickable Image Container */}
        <div
          onClick={() => {
            setZoomedIndex(idx);
            setIsExtraZoomed(false);
          }}
          className="aspect-[4/5] bg-neutral-200 overflow-hidden relative cursor-pointer"
          title="Klik untuk melihat foto & ukuran lengkap (cm)"
        >
          <img
            src={p.img}
            alt={p.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />

          {/* Zoom hint overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-1 pointer-events-none">
            <ZoomIn className="w-7 h-7 text-[#e9ff00] drop-shadow" />
            <span className="font-mono-code text-[10px] uppercase tracking-widest font-bold bg-[#0a0a0a]/80 px-2 py-0.5 rounded text-[#e9ff00]">
              Detail & Ukuran
            </span>
          </div>
        </div>

        {/* Card Content */}
        <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
          <div>
            {/* Category tag & Shop location */}
            <div className="flex items-center justify-between text-[10px] font-mono-code text-[#0a0a0a]/60 mb-1">
              <span className="font-bold uppercase text-[#0a0a0a]/80 bg-neutral-100 px-1.5 py-0.5 rounded">
                {p.category || p.tag}
              </span>
              {p.location && (
                <span className="flex items-center gap-0.5 text-[#0a0a0a]/70">
                  <MapPin className="w-2.5 h-2.5 text-[#ff5a1f]" />
                  <span>{p.location}</span>
                </span>
              )}
            </div>

            {/* Product Title */}
            <h3
              onClick={() => {
                setZoomedIndex(idx);
                setIsExtraZoomed(false);
              }}
              className="font-display text-lg sm:text-xl tracking-wider text-[#0a0a0a] leading-tight group-hover:text-[#ff5a1f] transition-colors cursor-pointer line-clamp-2"
              title={p.name}
            >
              {p.name}
            </h3>

            {/* Rating & Sold count */}
            <div className="flex items-center gap-2 mt-1.5 text-[11px] font-mono-code">
              {p.rating && (
                <div className="flex items-center text-amber-500 font-bold">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400 mr-0.5" />
                  <span>{p.rating}</span>
                </div>
              )}
              {p.sold_count && (
                <span className="text-[#0a0a0a]/50 border-l border-[#0a0a0a]/15 pl-2">
                  {p.sold_count > 1000 ? (p.sold_count / 1000).toFixed(1) + 'rb' : p.sold_count} Terjual
                </span>
              )}
            </div>
          </div>

          {/* Size Selector Bar */}
          <div className="pt-2 border-t border-[#0a0a0a]/10">
            <div className="text-[10px] font-mono-code text-[#0a0a0a]/60 uppercase font-semibold mb-1 flex justify-between">
              <span>Pilihan Ukuran:</span>
              <b className="text-[#0a0a0a]">{currentSize}</b>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none font-mono-code text-[10px] py-0.5">
              {availableSizes.map((sz) => {
                const isSel = currentSize === sz;
                return (
                  <button
                    key={sz}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectSize(p.id, sz);
                    }}
                    className={`px-2 py-1 rounded font-bold transition-all cursor-pointer border whitespace-nowrap ${
                      isSel
                        ? 'bg-[#0a0a0a] text-[#e9ff00] border-[#0a0a0a]'
                        : 'bg-neutral-100 text-[#0a0a0a]/80 border-transparent hover:border-[#0a0a0a]/30'
                    }`}
                  >
                    {sz}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Price & Add to Cart */}
          <div className="flex items-end justify-between pt-1">
            <div>
              {p.original_price && p.original_price > p.price && (
                <div className="font-mono-code text-[11px] text-[#0a0a0a]/40 line-through leading-none mb-0.5">
                  {fmtIDR(p.original_price)}
                </div>
              )}
              <div className="font-mono-code text-sm sm:text-base font-extrabold text-[#0a0a0a] leading-none">
                {fmtIDR(p.price)}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleAdd(p)}
              data-add={p.id}
              data-testid={`add-to-cart-${p.id}`}
              className={`px-3 py-1.5 font-mono-code uppercase text-[11px] font-bold tracking-widest rounded flex items-center gap-1 transition-all cursor-pointer ${
                isJustAdded
                  ? 'bg-[#e9ff00] text-[#0a0a0a]'
                  : 'bg-[#0a0a0a] text-[#f4f2ee] hover:bg-[#ff5a1f]'
              }`}
            >
              {isJustAdded ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Added</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Beli</span>
                </>
              )}
            </button>
          </div>
        </div>
      </article>
    );
  }

  /* RENDER FULLSCREEN ZOOM LIGHTBOX MODAL WITH CM MEASUREMENTS */
  function renderDetailModal(p: Product) {
    const productImages = p.images && p.images.length > 0 ? p.images : [p.img];
    const currentImg = productImages[activeImgIndex] || p.img;
    const currentSize = getProductSize(p);
    const availableSizes = p.sizes && p.sizes.length > 0 ? p.sizes : DEFAULT_SIZES;

    return (
      <div
        className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 transition-all"
        onClick={() => {
          setZoomedIndex(null);
          setIsExtraZoomed(false);
        }}
      >
        <div
          className="bg-[#0f0f0f] border border-neutral-800 rounded-xl max-w-4xl w-full max-h-[92vh] overflow-hidden shadow-2xl flex flex-col md:flex-row relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={() => {
              setZoomedIndex(null);
              setIsExtraZoomed(false);
            }}
            className="absolute top-3 right-3 z-20 bg-black/80 hover:bg-[#ff5a1f] text-white p-2 rounded-full border border-white/20 transition-colors cursor-pointer"
            title="Tutup (ESC)"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Prev Nav */}
          {filteredProducts.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setZoomedIndex(zoomedIndex !== null && zoomedIndex > 0 ? zoomedIndex - 1 : filteredProducts.length - 1);
                setIsExtraZoomed(false);
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 bg-black/80 hover:bg-[#e9ff00] hover:text-black text-white p-2.5 rounded-full border border-white/20 transition-all cursor-pointer"
              title="Item Sebelumnya"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Next Nav */}
          {filteredProducts.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setZoomedIndex(zoomedIndex !== null && zoomedIndex < filteredProducts.length - 1 ? zoomedIndex + 1 : 0);
                setIsExtraZoomed(false);
              }}
              className="absolute right-3 md:right-84 top-1/2 -translate-y-1/2 z-20 bg-black/80 hover:bg-[#e9ff00] hover:text-black text-white p-2.5 rounded-full border border-white/20 transition-all cursor-pointer"
              title="Item Selanjutnya"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Left Main Image Area */}
          <div
            className={`flex-1 relative flex flex-col items-center justify-center overflow-auto min-h-[320px] sm:min-h-[460px] p-4 transition-colors duration-300 ${
              zoomBgMode === 'soft-light'
                ? 'bg-[#f0f0ed]'
                : zoomBgMode === 'white'
                ? 'bg-white'
                : 'bg-[#0a0a0a]'
            }`}
          >
            <img
              src={currentImg}
              alt={p.name}
              onClick={() => setIsExtraZoomed(!isExtraZoomed)}
              className={`max-h-[60vh] w-auto object-contain transition-transform duration-300 cursor-zoom-in drop-shadow-md ${
                isExtraZoomed ? 'scale-150 sm:scale-175 cursor-zoom-out' : 'hover:scale-105'
              }`}
            />

            {/* Image Thumbnails */}
            {productImages.length > 1 && (
              <div className="flex items-center gap-2 mt-4 z-20 bg-black/80 p-2 rounded-lg border border-neutral-800">
                {productImages.map((imgUrl, iIdx) => (
                  <button
                    key={iIdx}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveImgIndex(iIdx);
                      setIsExtraZoomed(false);
                    }}
                    className={`w-12 h-12 rounded overflow-hidden border-2 transition-all cursor-pointer ${
                      activeImgIndex === iIdx
                        ? 'border-[#e9ff00] scale-105 shadow-md'
                        : 'border-neutral-700 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={imgUrl} alt={`Thumb ${iIdx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Background Mode Switcher */}
            <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/80 border border-white/20 p-1 rounded-full font-mono-code text-xs text-white z-10 shadow-lg">
              <button
                type="button"
                onClick={() => setZoomBgMode('soft-light')}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                  zoomBgMode === 'soft-light' ? 'bg-[#e9ff00] text-black' : 'text-neutral-300'
                }`}
              >
                Soft
              </button>
              <button
                type="button"
                onClick={() => setZoomBgMode('white')}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                  zoomBgMode === 'white' ? 'bg-white text-black' : 'text-neutral-300'
                }`}
              >
                Putih
              </button>
              <button
                type="button"
                onClick={() => setZoomBgMode('dark')}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                  zoomBgMode === 'dark' ? 'bg-neutral-800 text-[#e9ff00]' : 'text-neutral-300'
                }`}
              >
                Gelap
              </button>
            </div>
          </div>

          {/* Right Sidebar Product Info */}
          <div className="w-full md:w-84 bg-[#0d0d0d] p-6 flex flex-col justify-between border-t md:border-t-0 md:border-l border-neutral-800 overflow-y-auto max-h-[85vh]">
            <div className="space-y-4">
              {/* Badges */}
              <div className="flex items-center justify-between">
                <span className="bg-[#0a0a0a] border border-[#e9ff00]/40 text-[#e9ff00] font-mono-code text-[10px] uppercase font-bold px-2.5 py-1 rounded tracking-wider">
                  {p.category || p.tag}
                </span>
                {p.seller_platform && (
                  <span className="font-mono-code text-xs text-neutral-300 font-bold">
                    {p.seller_platform}
                  </span>
                )}
              </div>

              {/* Title & Price */}
              <div>
                <h3 className="font-display text-2xl sm:text-3xl text-white tracking-wider leading-tight">
                  {p.name}
                </h3>
                <div className="flex items-baseline gap-2 mt-2">
                  <div className="font-mono-code text-2xl font-extrabold text-[#e9ff00]">
                    {fmtIDR(p.price)}
                  </div>
                  {p.original_price && p.original_price > p.price && (
                    <div className="font-mono-code text-xs text-neutral-500 line-through">
                      {fmtIDR(p.original_price)}
                    </div>
                  )}
                </div>

                {/* Seller & Rating info */}
                <div className="flex items-center gap-3 mt-2 text-xs font-mono-code text-neutral-400">
                  {p.seller_name && <span>Toko: <b className="text-white">{p.seller_name}</b></span>}
                  {p.location && <span>📍 {p.location}</span>}
                </div>
              </div>

              {/* Description */}
              {p.description && (
                <div className="border-t border-neutral-800 pt-3">
                  <div className="text-[11px] font-mono-code text-neutral-400 uppercase font-semibold mb-1">
                    Deskripsi Item Marketplace:
                  </div>
                  <p className="text-xs font-sans-body text-neutral-300 leading-relaxed">
                    {p.description}
                  </p>
                </div>
              )}

              {/* Size CM Measurements */}
              {p.sizes_cm && (
                <div className="border-t border-neutral-800 pt-3">
                  <div className="text-[11px] font-mono-code text-[#e9ff00] uppercase font-semibold mb-1 flex items-center gap-1.5">
                    <Ruler className="w-3.5 h-3.5 text-[#e9ff00]" />
                    <span>Panduan Ukuran (cm):</span>
                  </div>
                  <div className="bg-neutral-900/90 border border-neutral-800 p-3 rounded font-mono-code text-[11px] text-neutral-200 leading-relaxed whitespace-pre-line">
                    {p.sizes_cm}
                  </div>
                </div>
              )}

              {/* Size Picker */}
              <div className="border-t border-neutral-800 pt-3">
                <div className="text-xs font-mono-code text-neutral-400 uppercase font-semibold mb-2 flex justify-between">
                  <span>Pilih Ukuran dibeli:</span>
                  <b className="text-[#e9ff00]">{currentSize}</b>
                </div>
                <div className="flex flex-wrap gap-1.5 font-mono-code text-xs">
                  {availableSizes.map((sz) => {
                    const isSel = currentSize === sz;
                    return (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => handleSelectSize(p.id, sz)}
                        className={`flex-1 py-1.5 px-3 rounded font-bold transition-all cursor-pointer border ${
                          isSel
                            ? 'bg-[#e9ff00] text-[#0a0a0a] border-[#e9ff00]'
                            : 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:border-neutral-600'
                        }`}
                      >
                        {sz}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Add to Cart Button */}
            <div className="pt-6 space-y-3 border-t border-neutral-800 mt-4">
              <button
                type="button"
                onClick={() => handleAdd(p)}
                className={`w-full py-3.5 font-mono-code uppercase text-xs tracking-widest font-bold rounded flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  addedIds[p.id]
                    ? 'bg-[#e9ff00] text-[#0a0a0a]'
                    : 'bg-white hover:bg-[#e9ff00] text-[#0a0a0a]'
                }`}
              >
                {addedIds[p.id] ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Berhasil Masuk Keranjang</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Tambah ke Keranjang ({currentSize})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
};
