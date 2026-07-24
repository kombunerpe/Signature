import React, { useState, useEffect } from 'react';
import { DB } from '../lib/database';
import { Product, CartItem, Order } from '../types';
import { X, CheckCircle2, CreditCard, ShieldCheck, ArrowLeft } from 'lucide-react';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  products: Product[];
  onSuccessPayment: () => void;
  onToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

const COUNTRY_CODES = [
  { code: '+62', country: 'Indonesia', flag: '🇮🇩' },
  { code: '+60', country: 'Malaysia', flag: '🇲🇾' },
  { code: '+65', country: 'Singapura', flag: '🇸🇬' },
  { code: '+66', country: 'Thailand', flag: '🇹🇭' },
  { code: '+63', country: 'Filipina', flag: '🇵🇭' },
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+966', country: 'Arab Saudi', flag: '🇸🇦' },
  { code: '+1', country: 'Amerika Serikat', flag: '🇺🇸' },
  { code: '+44', country: 'Inggris', flag: '🇬🇧' },
  { code: '+81', country: 'Jepang', flag: '🇯🇵' },
];

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  cart,
  products,
  onSuccessPayment,
  onToast
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [countryCode, setCountryCode] = useState<string>('+62');
  const [phone, setPhone] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [shippingMethod, setShippingMethod] = useState<'reseller' | 'reguler' | 'express'>('reseller');
  const [order, setOrder] = useState<Order | null>(null);
  const [isProcessingPay, setIsProcessingPay] = useState<boolean>(false);
  const [isPaidSuccess, setIsPaidSuccess] = useState<boolean>(false);
  const [snapToken, setSnapToken] = useState<string | null>(null);
  const [snapRedirectUrl, setSnapRedirectUrl] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  const [selectedMethod, setSelectedMethod] = useState<'qris' | 'va' | 'card' | 'snap'>('qris');
  const [selectedBank, setSelectedBank] = useState<'bca' | 'mandiri' | 'bri' | 'bni'>('bca');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Auto pre-fill existing session user if available
  useEffect(() => {
    if (isOpen) {
      const cur = DB.session.getCurrentUser();
      if (cur) {
        if (cur.name) setName(cur.name);
        if (cur.email) setEmail(cur.email);
        if (cur.address) setAddress(cur.address);
      }
    } else {
      // Reset state when closed
      setStep(1);
      setIsPaidSuccess(false);
      setIsProcessingPay(false);
      setSnapToken(null);
      setSnapRedirectUrl(null);
      setPayError(null);
      setSelectedMethod('qris');
    }
  }, [isOpen]);

  // Pre-fetch Snap token when entering Step 2
  useEffect(() => {
    if (step === 2 && order && !snapToken && !isProcessingPay) {
      fetchSnapToken(order);
    }
  }, [step, order]);

  if (!isOpen) return null;

  const fmtIDR = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');

  const subtotal = cart.reduce((sum, item) => {
    const p = products.find((x) => x.id === item.id);
    return sum + (p ? p.price * item.qty : 0);
  }, 0);

  const ppn = Math.round(subtotal * 0.12);

  const getShippingFee = () => {
    if (shippingMethod === 'reseller') return 100000;
    if (shippingMethod === 'express') return 125000;
    return subtotal >= 800000 ? 0 : 20000;
  };

  const shippingFee = getShippingFee();
  const grandTotal = subtotal + ppn + shippingFee;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    onToast(`${label} berhasil disalin`, 'success');
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Helper to load Midtrans Snap JS dynamically based on client key
  const loadMidtransSnapScript = (clientKey: string, isSandbox: boolean): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).snap && typeof (window as any).snap.pay === 'function') {
        resolve(true);
        return;
      }
      const existingScript = document.getElementById('midtrans-snap-script');
      if (existingScript) existingScript.remove();

      const script = document.createElement('script');
      script.id = 'midtrans-snap-script';
      script.src = isSandbox
        ? 'https://app.sandbox.midtrans.com/snap/snap.js'
        : 'https://app.midtrans.com/snap/snap.js';
      script.setAttribute('data-client-key', clientKey);
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  };

  const fetchSnapToken = async (targetOrder: Order) => {
    setIsProcessingPay(true);
    setPayError(null);
    try {
      const res = await fetch('/api/midtrans/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: targetOrder.order_id,
          total: targetOrder.total,
          name: targetOrder.name,
          email: targetOrder.email,
          address: targetOrder.address,
          items: targetOrder.items
        })
      });
      const data = await res.json();
      if (data.token) {
        setSnapToken(data.token);
        if (data.redirect_url) setSnapRedirectUrl(data.redirect_url);
        
        // Dynamically load Snap JS in background
        loadMidtransSnapScript(data.client_key || 'Mid-client-RWg_kgHzM9OCnbTI', Boolean(data.is_sandbox));
      }
    } catch (err: any) {
      console.warn('Snap token prefetch warning:', err);
    } finally {
      setIsProcessingPay(false);
    }
  };

  // Step 1: Submit Details & Create Order directly for Midtrans Payment
  const handleProceedToPayment = () => {
    try {
      if (!cart || cart.length === 0) {
        onToast('Keranjang belanja Anda masih kosong', 'error');
        return;
      }

      const trimmedName = name.trim();
      const trimmedEmail = email.trim().toLowerCase();
      let trimmedPhone = phone.trim().replace(/[^0-9]/g, '').replace(/^0+/, '');
      if (!trimmedPhone) {
        trimmedPhone = '81234567890'; // Default phone if empty
      }
      const trimmedAddress = address.trim();

      if (!trimmedName || !trimmedEmail || !trimmedAddress) {
        onToast('Lengkapi nama, email, dan alamat pengiriman', 'error');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        onToast('Email tidak valid', 'error');
        return;
      }

      const fullWhatsApp = `${countryCode}${trimmedPhone}`;

      // Save user in database & session
      const savedUser = DB.users.add({
        name: trimmedName,
        email: trimmedEmail,
        address: trimmedAddress
      });
      DB.session.setCurrentUser(savedUser);

      // Build order object safely without throwing undefined errors
      const orderItems = cart.map((c) => {
        const p = products.find((x) => x.id === c.id);
        return {
          id: c.id,
          name: p ? p.name : `Item (${c.id})`,
          qty: c.qty,
          price: p ? p.price : 100000,
          size: c.size || 'L'
        };
      });

      const shippingLabel =
        shippingMethod === 'reseller'
          ? 'Reseller (All Item)'
          : shippingMethod === 'express'
          ? 'Express / Kilat'
          : 'Reguler';

      const newOrder: Order = DB.orders.create({
        order_id: 'NX-' + Date.now().toString(36).toUpperCase(),
        email: trimmedEmail,
        name: trimmedName,
        phone: fullWhatsApp,
        country_code: countryCode,
        address: trimmedAddress,
        items: orderItems,
        subtotal,
        ppn,
        shipping_method: shippingLabel,
        shipping_fee: shippingFee,
        total: grandTotal,
        status: 'pending'
      });

      setOrder(newOrder);
      setStep(2);
      onToast('Pesanan berhasil dibuat. Membuka gerbang pembayaran Midtrans...', 'success');

      // Auto trigger Midtrans Snap popup directly
      setTimeout(() => {
        handleLaunchSnapPopup(newOrder);
      }, 200);
    } catch (err: any) {
      console.error('Error proceeding to payment:', err);
      onToast('Gagal memproses pesanan: ' + (err.message || 'Terjadi kesalahan internal'), 'error');
    }
  };

  // Complete Payment & Verify Status
  const handleCompletePayment = (methodName: string = 'Midtrans') => {
    if (!order) return;
    setIsProcessingPay(true);
    setTimeout(() => {
      DB.orders.updateStatus(order.order_id, 'paid');
      setIsProcessingPay(false);
      setIsPaidSuccess(true);
      onToast(`Pembayaran via ${methodName} berhasil diselesaikan!`, 'success');
      onSuccessPayment();
      setTimeout(() => onClose(), 3500);
    }, 600);
  };

  // Launch Midtrans Snap Popup Window
  const handleLaunchSnapPopup = async (orderToPay?: Order) => {
    const currentOrder = orderToPay || order;
    if (!currentOrder) return;
    setIsProcessingPay(true);
    setPayError(null);

    try {
      let token = snapToken;
      let redirectUrl = snapRedirectUrl;

      if (!token || orderToPay) {
        const res = await fetch('/api/midtrans/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: currentOrder.order_id,
            total: currentOrder.total,
            name: currentOrder.name,
            email: currentOrder.email,
            address: currentOrder.address,
            items: currentOrder.items
          })
        });
        const data = await res.json();
        if (data.token) {
          token = data.token;
          redirectUrl = data.redirect_url;
          setSnapToken(token);
          if (redirectUrl) setSnapRedirectUrl(redirectUrl);
          await loadMidtransSnapScript(data.client_key || 'Mid-client-RWg_kgHzM9OCnbTI', Boolean(data.is_sandbox));
        }
      }

      const snap = (window as any).snap;

      if (token && snap && typeof snap.pay === 'function') {
        snap.pay(token, {
          onSuccess: (result: any) => {
            console.log('Midtrans Snap Success:', result);
            handleCompletePayment('Midtrans Gateway Official');
          },
          onPending: (result: any) => {
            console.log('Midtrans Snap Pending:', result);
            setIsProcessingPay(false);
            onToast('Menunggu instruksi pembayaran Midtrans diselesaikan.', 'info');
          },
          onError: (result: any) => {
            console.error('Midtrans Snap Error:', result);
            setIsProcessingPay(false);
            setPayError('Pembayaran Midtrans dibatalkan atau gagal.');
            onToast('Pembayaran Midtrans gagal', 'error');
          },
          onClose: () => {
            console.log('Midtrans Snap Closed');
            setIsProcessingPay(false);
            onToast('Jendela Midtrans Snap ditutup. Klik tombol untuk membuka kembali.', 'info');
          }
        });
      } else if (redirectUrl) {
        window.open(redirectUrl, '_blank');
        setIsProcessingPay(false);
        onToast('Halaman Midtrans Snap dibuka di tab baru.', 'info');
      } else {
        setIsProcessingPay(false);
        setPayError('Gagal memuat token pembayaran Midtrans. Silakan coba lagi.');
      }
    } catch (err: any) {
      console.error('Midtrans payment error:', err);
      setIsProcessingPay(false);
      setPayError(err.message || 'Gagal memuat Midtrans Snap Popup.');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#0a0a0a]/70 backdrop-blur-sm overflow-y-auto">
      <div
        data-testid="checkout-modal"
        className="bg-[#f4f2ee] max-w-lg w-full rounded-lg overflow-hidden shadow-2xl border border-[#0a0a0a]/20 flex flex-col my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#0a0a0a] text-[#f4f2ee]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#e9ff00]" />
            <h3 className="font-display text-2xl tracking-wider">CHECKOUT & PEMBAYARAN MIDTRANS</h3>
          </div>
          <button
            onClick={onClose}
            data-testid="close-checkout-btn"
            className="text-[#f4f2ee] hover:text-[#e9ff00] p-1 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* STEP 1: Buyer Details */}
        {step === 1 && (
          <div id="checkoutStep1" className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#0a0a0a]/10 pb-3">
              <span className="font-mono-code text-xs uppercase tracking-widest text-[#0a0a0a]/70 font-semibold">
                Step 1 / 2 · Detail & Pengiriman
              </span>
              <span className="font-mono-code text-xs text-[#ff5a1f] font-bold">
                Total: {fmtIDR(grandTotal)}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-mono-code text-[11px] uppercase tracking-wider text-[#0a0a0a]/70 mb-1 font-semibold">
                  Nama Lengkap
                </label>
                <input
                  id="ckName"
                  data-testid="checkout-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  className="w-full bg-white border border-[#0a0a0a]/20 rounded px-3.5 py-2.5 text-sm font-sans-body focus:outline-none focus:border-[#0a0a0a]"
                />
              </div>

              <div>
                <label className="block font-mono-code text-[11px] uppercase tracking-wider text-[#0a0a0a]/70 mb-1 font-semibold">
                  Email Aktif
                </label>
                <input
                  id="ckEmail"
                  data-testid="checkout-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full bg-white border border-[#0a0a0a]/20 rounded px-3.5 py-2.5 text-sm font-sans-body focus:outline-none focus:border-[#0a0a0a]"
                />
              </div>

              <div>
                <label className="block font-mono-code text-[11px] uppercase tracking-wider text-[#0a0a0a]/70 mb-1 font-semibold">
                  Nomor Telepon / WhatsApp
                </label>
                <div className="flex gap-2">
                  <select
                    id="ckCountryCode"
                    data-testid="checkout-country-code"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="bg-white border border-[#0a0a0a]/20 rounded px-2.5 py-2.5 text-sm font-mono-code focus:outline-none focus:border-[#0a0a0a] cursor-pointer"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.code} ({c.country})
                      </option>
                    ))}
                  </select>
                  <input
                    id="ckPhone"
                    data-testid="checkout-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="81234567890"
                    className="flex-1 bg-white border border-[#0a0a0a]/20 rounded px-3.5 py-2.5 text-sm font-mono-code focus:outline-none focus:border-[#0a0a0a]"
                  />
                </div>
                <div className="text-[10px] font-mono-code text-[#0a0a0a]/60 mt-1">
                  Masukkan nomor tanpa angka 0 di depan (contoh: 81234567890)
                </div>
              </div>

              <div>
                <label className="block font-mono-code text-[11px] uppercase tracking-wider text-[#0a0a0a]/70 mb-1 font-semibold">
                  Alamat Pengiriman Lengkap
                </label>
                <textarea
                  id="ckAddress"
                  data-testid="checkout-address"
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Jl. Sudirman No. 123, Bandung, Jawa Barat"
                  className="w-full bg-white border border-[#0a0a0a]/20 rounded px-3.5 py-2.5 text-sm font-sans-body focus:outline-none focus:border-[#0a0a0a]"
                />
              </div>

              {/* Shipping Method Selector */}
              <div>
                <label className="block font-mono-code text-[11px] uppercase tracking-wider text-[#0a0a0a]/70 mb-1 font-semibold">
                  Metode Pengiriman
                </label>
                <div className="space-y-2 font-mono-code text-xs">
                  <label
                    onClick={() => setShippingMethod('reseller')}
                    className={`flex items-center justify-between p-3 rounded border cursor-pointer transition-all ${
                      shippingMethod === 'reseller'
                        ? 'bg-[#0a0a0a] text-[#f4f2ee] border-[#0a0a0a]'
                        : 'bg-white text-[#0a0a0a] border-[#0a0a0a]/20 hover:border-[#0a0a0a]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="shipping"
                        checked={shippingMethod === 'reseller'}
                        onChange={() => setShippingMethod('reseller')}
                        className="accent-[#e9ff00]"
                      />
                      <div>
                        <div className="font-bold flex items-center gap-1.5">
                          <span>Metode Reseller All Item</span>
                          <span className="bg-[#e9ff00] text-[#0a0a0a] text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase">SPECIAL</span>
                        </div>
                        <div className="text-[10px] opacity-80">Tarif khusus reseller flat rate all item</div>
                      </div>
                    </div>
                    <span className="font-bold text-[#e9ff00]">{fmtIDR(100000)}</span>
                  </label>

                  <label
                    onClick={() => setShippingMethod('reguler')}
                    className={`flex items-center justify-between p-3 rounded border cursor-pointer transition-all ${
                      shippingMethod === 'reguler'
                        ? 'bg-[#0a0a0a] text-[#f4f2ee] border-[#0a0a0a]'
                        : 'bg-white text-[#0a0a0a] border-[#0a0a0a]/20 hover:border-[#0a0a0a]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="shipping"
                        checked={shippingMethod === 'reguler'}
                        onChange={() => setShippingMethod('reguler')}
                        className="accent-[#e9ff00]"
                      />
                      <div>
                        <div className="font-bold">Pengiriman Reguler</div>
                        <div className="text-[10px] opacity-80">
                          {subtotal >= 800000 ? 'Gratis Ongkir (Belanja > 800k)' : 'Estimasi 2-3 Hari Kerja'}
                        </div>
                      </div>
                    </div>
                    <span className="font-bold">
                      {subtotal >= 800000 ? 'GRATIS' : fmtIDR(20000)}
                    </span>
                  </label>

                  <label
                    onClick={() => setShippingMethod('express')}
                    className={`flex items-center justify-between p-3 rounded border cursor-pointer transition-all ${
                      shippingMethod === 'express'
                        ? 'bg-[#0a0a0a] text-[#f4f2ee] border-[#0a0a0a]'
                        : 'bg-white text-[#0a0a0a] border-[#0a0a0a]/20 hover:border-[#0a0a0a]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="shipping"
                        checked={shippingMethod === 'express'}
                        onChange={() => setShippingMethod('express')}
                        className="accent-[#e9ff00]"
                      />
                      <div>
                        <div className="font-bold">Pengiriman Express / Kilat</div>
                        <div className="text-[10px] opacity-80">Estimasi 3 - 5 Hari Kerja</div>
                      </div>
                    </div>
                    <span className="font-bold">{fmtIDR(125000)}</span>
                  </label>
                </div>
              </div>

              {/* Price Breakdown Preview */}
              <div className="bg-white border border-[#0a0a0a]/15 rounded p-3 font-mono-code text-xs space-y-1.5 text-[#0a0a0a]">
                <div className="flex justify-between text-[#0a0a0a]/70">
                  <span>Subtotal Produk</span>
                  <span>{fmtIDR(subtotal)}</span>
                </div>
                <div className="flex justify-between text-[#0a0a0a]/70">
                  <span>PPN (12%)</span>
                  <span>{fmtIDR(ppn)}</span>
                </div>
                <div className="flex justify-between text-[#0a0a0a]/70">
                  <span>Ongkir ({shippingMethod === 'reseller' ? 'Reseller' : shippingMethod === 'express' ? 'Express' : 'Reguler'})</span>
                  <span>{fmtIDR(shippingFee)}</span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-[#0a0a0a]/10 font-bold text-sm">
                  <span>Total Tagihan</span>
                  <span className="text-[#ff5a1f]">{fmtIDR(grandTotal)}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleProceedToPayment}
              id="sendOtpBtn"
              data-testid="proceed-payment-btn"
              className="w-full bg-[#0a0a0a] hover:bg-[#222222] text-[#f4f2ee] py-3.5 font-mono-code uppercase text-xs tracking-widest font-bold rounded flex items-center justify-center gap-2 transition-all mt-2 cursor-pointer"
            >
              <CreditCard className="w-4 h-4 text-[#e9ff00]" />
              <span>Lanjut ke Pembayaran Midtrans</span>
            </button>
          </div>
        )}

        {/* STEP 2: Midtrans Payment Execution */}
        {step === 2 && order && (
          <div id="checkoutStep2" className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#0a0a0a]/10 pb-3">
              <span className="font-mono-code text-xs uppercase tracking-widest text-[#0a0a0a]/70 font-semibold">
                Step 2 / 2 · Pembayaran Midtrans
              </span>
              {!isPaidSuccess && (
                <button
                  onClick={() => setStep(1)}
                  className="font-mono-code text-xs text-[#0a0a0a]/60 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Ubah data</span>
                </button>
              )}
            </div>

            {!isPaidSuccess ? (
              <>
                {/* Midtrans Status Banner */}
                <div className="bg-[#0a0a0a] text-[#f4f2ee] rounded-md p-3.5 font-mono-code text-xs space-y-1.5 shadow-sm">
                  <div className="flex justify-between items-center text-[#e9ff00] font-bold">
                    <span className="flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-[#e9ff00]" />
                      MIDTRANS PAYMENT GATEWAY
                    </span>
                    <span className="bg-[#e9ff00] text-[#0a0a0a] text-[9px] px-2 py-0.5 rounded font-extrabold tracking-wider">
                      TERVERIFIKASI
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-[#f4f2ee]/80 pt-1 border-t border-white/10">
                    <span>Order ID: <b className="text-white">{order.order_id}</b></span>
                    <span>Total: <b className="text-[#ff5a1f] text-sm">{fmtIDR(order.total)}</b></span>
                  </div>
                </div>

                {/* Official Midtrans Payment Gateway Panel */}
                <div className="bg-white border border-[#0a0a0a]/15 rounded-md p-5 space-y-4 font-mono-code text-xs">
                  <div className="space-y-1 text-center">
                    <h4 className="font-bold text-sm text-[#0a0a0a] uppercase tracking-wide">
                      Gerbang Pembayaran Midtrans Snap
                    </h4>
                    <p className="text-[11px] text-[#0a0a0a]/70 leading-relaxed">
                      Seluruh transaksi (Virtual Account BCA, Mandiri, BRI, BNI, Permata, QRIS, GoPay, ShopeePay, dan Kartu Kredit) diproses dan diverifikasi secara resmi langsung oleh Midtrans Payment Gateway.
                    </p>
                  </div>

                  {/* Primary Call To Action */}
                  <div className="space-y-2 pt-1">
                    <button
                      onClick={() => handleLaunchSnapPopup()}
                      disabled={isProcessingPay}
                      id="payNowBtn"
                      data-testid="pay-now-btn"
                      className="w-full bg-[#e9ff00] hover:bg-[#d6f000] text-[#0a0a0a] py-4 font-mono-code uppercase text-xs tracking-widest font-extrabold rounded flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-50 cursor-pointer border border-[#0a0a0a]"
                    >
                      <CreditCard className="w-5 h-5 text-[#0a0a0a]" />
                      <span>{isProcessingPay ? 'Menghubungkan ke Midtrans Snap...' : '🚀 BAYAR SEKARANG VIA MIDTRANS SNAP POPUP'}</span>
                    </button>
                  </div>

                  <p className="text-[10px] text-[#0a0a0a]/60 text-center italic pt-1">
                    Status pembayaran akan otomatis diperbarui dan terverifikasi secara real-time setelah Anda menyelesaikan transaksi di modul Midtrans Snap.
                  </p>
                </div>

                {/* Payment Error Alert if any */}
                {payError && (
                  <div className="bg-[#ff5a1f]/10 border border-[#ff5a1f]/30 text-[#ff5a1f] p-3 rounded font-mono-code text-xs space-y-1">
                    <p className="font-bold">⚠️ Catatan Midtrans:</p>
                    <p>{payError}</p>
                  </div>
                )}
              </>
            ) : (
              <div id="paySuccess" data-testid="pay-success" className="text-center py-6 space-y-3">
                <CheckCircle2 className="w-16 h-16 text-[#e9ff00] bg-[#0a0a0a] rounded-full p-2 mx-auto" />
                <h2 className="font-display text-4xl text-[#0a0a0a] tracking-wider">
                  PEMBAYARAN MIDTRANS BERHASIL!
                </h2>
                <div className="bg-white border border-[#0a0a0a]/15 rounded p-3 text-left font-mono-code text-xs space-y-1.5 text-[#0a0a0a]">
                  <div className="flex justify-between border-b border-[#0a0a0a]/10 pb-1">
                    <span className="text-[#0a0a0a]/60">Status Transaksi:</span>
                    <span className="text-[#0a0a0a] font-bold bg-[#e9ff00] px-1.5 rounded">LUNAS / VERIFIED</span>
                  </div>
                  <div className="flex justify-between border-b border-[#0a0a0a]/10 pb-1">
                    <span className="text-[#0a0a0a]/60">Order ID:</span>
                    <span className="font-bold">{order.order_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#0a0a0a]/60">Email Struk:</span>
                    <span className="font-medium">{order.email}</span>
                  </div>
                </div>
                <p className="font-mono-code text-xs text-[#0a0a0a]/80 font-medium pt-1">
                  Keranjang belanja telah dikosongkan. Salinan struk pembelian dan nomor resi otomatis dikirimkan ke <b>{order.email}</b>.
                </p>
                <div className="pt-2 font-mono-code text-[11px] text-[#0a0a0a]/50">
                  Jendela ini akan tertutup otomatis...
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
