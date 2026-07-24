import React, { useState, useEffect } from 'react';
import { DB, subscribeDB } from './lib/database';
import { Product, CartItem, ToastNotification } from './types';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { ProductCatalog } from './components/ProductCatalog';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutModal } from './components/CheckoutModal';
import { ChatWidget } from './components/ChatWidget';
import { AdminDashboard } from './components/AdminDashboard';
import { Footer } from './components/Footer';

export default function App() {
  const [activeView, setActiveView] = useState<'store' | 'admin'>('store');
  const [products, setProducts] = useState<Product[]>(() => DB.products.getAll());

  useEffect(() => {
    const unsub = subscribeDB(() => {
      setProducts(DB.products.getAll());
    });
    return () => unsub();
  }, []);

  // Cart state persisted in localStorage
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('store_cart');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to load cart from localStorage', e);
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  // Sync cart to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('store_cart', JSON.stringify(cart));
    } catch (e) {
      console.error('Failed to save cart to localStorage', e);
    }
  }, [cart]);

  // Toast notification helper
  const addToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    const newToast: ToastNotification = { id, message, type };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  };

  // Cart handlers
  const handleAddToCart = (id: string, size: string = 'L') => {
    setCart((prevCart) => {
      const existing = prevCart.find((c) => c.id === id && (c.size || 'L') === size);
      if (existing) {
        return prevCart.map((c) =>
          c.id === id && (c.size || 'L') === size ? { ...c, qty: c.qty + 1 } : c
        );
      }
      return [...prevCart, { id, qty: 1, size }];
    });
    addToast(`Item (${size}) ditambahkan ke keranjang`, 'success');
  };

  const handleUpdateQty = (id: string, size: string | undefined, delta: number) => {
    const itemSize = size || 'L';
    setCart((prevCart) => {
      return prevCart
        .map((c) => {
          if (c.id === id && (c.size || 'L') === itemSize) {
            const newQty = c.qty + delta;
            return newQty > 0 ? { ...c, qty: newQty } : null;
          }
          return c;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const handleRemoveItem = (id: string, size?: string) => {
    const itemSize = size || 'L';
    setCart((prevCart) => prevCart.filter((c) => !(c.id === id && (c.size || 'L') === itemSize)));
    addToast('Item dihapus dari keranjang', 'info');
  };

  const handleSuccessPayment = () => {
    setCart([]);
    localStorage.removeItem('store_cart');
  };

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div className="min-h-screen flex flex-col font-sans-body selection:bg-[#e9ff00] selection:text-[#0a0a0a]">
      {/* Toast Notification Container */}
      <div id="toasts" className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] space-y-2 pointer-events-none w-full max-w-sm px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            data-testid="toast"
            className={`pointer-events-auto px-4 py-2.5 rounded shadow-xl font-mono-code text-xs uppercase tracking-wider font-semibold border flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-200 ${
              t.type === 'error'
                ? 'bg-[#ff5a1f] text-white border-[#0a0a0a]'
                : t.type === 'success'
                ? 'bg-[#e9ff00] text-[#0a0a0a] border-[#0a0a0a]'
                : 'bg-[#0a0a0a] text-[#f4f2ee] border-[#e9ff00]'
            }`}
          >
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Main Header */}
      <Header
        cartCount={cartCount}
        onOpenCart={() => setIsCartOpen(true)}
        activeView={activeView}
        onToggleView={(view) => setActiveView(view)}
      />

      {/* View Switch */}
      {activeView === 'store' ? (
        <main className="flex-1">
          <Hero onOpenChat={() => setIsChatOpen(true)} />
          <ProductCatalog products={products} onAddToCart={handleAddToCart} />
        </main>
      ) : (
        <main className="flex-1">
          <AdminDashboard
            onBackToShop={() => setActiveView('store')}
            onToast={addToast}
          />
        </main>
      )}

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        products={products}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveItem}
        onProceedToCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
      />

      {/* Checkout & OTP & Midtrans Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        cart={cart}
        products={products}
        onSuccessPayment={handleSuccessPayment}
        onToast={addToast}
      />

      {/* CS Chat Widget */}
      {activeView === 'store' && (
        <ChatWidget
          isOpen={isChatOpen}
          onToggle={() => setIsChatOpen((prev) => !prev)}
          onClose={() => setIsChatOpen(false)}
        />
      )}

      {/* Footer */}
      {activeView === 'store' && (
        <Footer onToggleAdmin={() => setActiveView('admin')} />
      )}
    </div>
  );
}
