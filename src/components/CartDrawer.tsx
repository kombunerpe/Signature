import React from 'react';
import { CartItem, Product } from '../types';
import { X, Plus, Minus, Trash2, ArrowRight, ShoppingBag } from 'lucide-react';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  products: Product[];
  onUpdateQty: (id: string, size: string | undefined, delta: number) => void;
  onRemoveItem: (id: string, size?: string) => void;
  onProceedToCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cart,
  products,
  onUpdateQty,
  onRemoveItem,
  onProceedToCheckout
}) => {
  if (!isOpen) return null;

  const fmtIDR = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');

  const subtotal = cart.reduce((sum, item) => {
    const prod = products.find((p) => p.id === item.id);
    return sum + (prod ? prod.price * item.qty : 0);
  }, 0);

  const ppn = Math.round(subtotal * 0.12);
  const cartTotal = subtotal + ppn;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#0a0a0a]/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <aside
        data-testid="cart-drawer"
        className="fixed top-0 right-0 h-full w-full max-w-md bg-[#f4f2ee] shadow-2xl flex flex-col z-10 border-l border-[#0a0a0a]/20 transform transition-transform duration-300 ease-out"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#0a0a0a] text-[#f4f2ee]">
          <div>
            <div className="font-mono-code text-[10px] uppercase tracking-widest text-[#e9ff00] font-semibold">
              Keranjang Belanja
            </div>
            <div className="font-display text-3xl tracking-wider">CART</div>
          </div>
          <button
            onClick={onClose}
            data-testid="close-cart-btn"
            className="p-1 text-[#f4f2ee] hover:text-[#e9ff00] transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Item List */}
        <div data-testid="cart-items" className="flex-1 overflow-y-auto p-6 space-y-4">
          {cart.length === 0 ? (
            <div
              data-testid="cart-empty"
              className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3"
            >
              <ShoppingBag className="w-12 h-12 text-[#0a0a0a]/30" />
              <p className="font-mono-code text-xs uppercase tracking-widest text-[#0a0a0a]/60 font-semibold">
                Keranjang kamu masih kosong
              </p>
              <button
                onClick={onClose}
                className="mt-2 bg-[#0a0a0a] text-[#f4f2ee] px-4 py-2 font-mono-code text-xs uppercase font-bold rounded cursor-pointer"
              >
                Mulai Belanja
              </button>
            </div>
          ) : (
            cart.map((item) => {
              const product = products.find((p) => p.id === item.id);
              if (!product) return null;
              const itemSize = item.size || 'L';
              const itemKey = `${item.id}-${itemSize}`;
              return (
                <div
                  key={itemKey}
                  data-testid={`cart-row-${product.id}`}
                  className="bg-white p-3.5 rounded-md border border-[#0a0a0a]/10 flex gap-4 items-center shadow-sm"
                >
                  <img
                    src={product.img}
                    alt={product.name}
                    className="w-16 h-20 object-cover rounded bg-neutral-100 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="font-display text-lg tracking-wide text-[#0a0a0a] truncate leading-tight">
                        {product.name}
                      </h4>
                      <span className="bg-[#0a0a0a] text-[#e9ff00] font-mono-code text-[10px] uppercase font-bold px-1.5 py-0.5 rounded">
                        Ukuran: {itemSize}
                      </span>
                    </div>
                    <div className="font-mono-code text-xs text-[#0a0a0a]/60 mt-0.5">
                      {fmtIDR(product.price)}
                    </div>

                    <div className="mt-2 inline-flex items-center border border-[#0a0a0a]/20 rounded overflow-hidden font-mono-code text-xs bg-[#f4f2ee]">
                      <button
                        onClick={() => onUpdateQty(product.id, itemSize, -1)}
                        data-qty="-"
                        data-id={product.id}
                        data-testid={`qty-dec-${product.id}`}
                        className="px-2 py-1 hover:bg-[#0a0a0a] hover:text-[#f4f2ee] transition-colors cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span
                        data-testid={`qty-val-${product.id}`}
                        className="px-3 py-1 font-bold text-[#0a0a0a]"
                      >
                        {item.qty}
                      </span>
                      <button
                        onClick={() => onUpdateQty(product.id, itemSize, 1)}
                        data-qty="+"
                        data-id={product.id}
                        data-testid={`qty-inc-${product.id}`}
                        className="px-2 py-1 hover:bg-[#0a0a0a] hover:text-[#f4f2ee] transition-colors cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col items-end justify-between self-stretch">
                    <button
                      onClick={() => onRemoveItem(product.id, itemSize)}
                      className="text-[#ff5a1f] hover:text-[#0a0a0a] transition-colors p-1 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <span className="font-mono-code text-xs font-bold text-[#0a0a0a]">
                      {fmtIDR(product.price * item.qty)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="border-t border-[#0a0a0a]/15 p-6 bg-white space-y-3 font-mono-code text-xs text-[#0a0a0a]">
            <div className="flex justify-between items-center text-[#0a0a0a]/70">
              <span className="uppercase tracking-wider">Subtotal Produk</span>
              <span className="font-medium">{fmtIDR(subtotal)}</span>
            </div>

            <div className="flex justify-between items-center text-[#0a0a0a]/70">
              <span className="uppercase tracking-wider flex items-center gap-1">
                <span>PPN (12%)</span>
                <span className="bg-[#0a0a0a] text-[#e9ff00] text-[9px] px-1 rounded font-bold">Wajib</span>
              </span>
              <span className="font-medium">{fmtIDR(ppn)}</span>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-[#0a0a0a]/10 text-sm">
              <span className="uppercase tracking-widest text-[#0a0a0a] font-bold">
                Total (Sebelum Ongkir)
              </span>
              <span data-testid="cart-total" id="cartTotal" className="font-bold text-lg text-[#0a0a0a]">
                {fmtIDR(cartTotal)}
              </span>
            </div>

            <button
              onClick={onProceedToCheckout}
              id="checkoutBtn"
              data-testid="checkout-btn"
              className="w-full bg-[#0a0a0a] hover:bg-[#222222] text-[#f4f2ee] py-3.5 font-mono-code uppercase text-xs tracking-widest font-bold rounded flex items-center justify-center gap-2 transition-all hover:shadow-md cursor-pointer mt-2"
            >
              <span>Lanjut ke Checkout</span>
              <ArrowRight className="w-4 h-4 text-[#e9ff00]" />
            </button>
          </div>
        )}
      </aside>
    </div>
  );
};
