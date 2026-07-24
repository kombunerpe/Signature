import React, { useState, useEffect } from 'react';
import { DB, subscribeDB } from '../lib/database';
import { User, ChatSession, ChatMessage, Order, Product } from '../types';
import {
  Users,
  MessageSquare,
  MessagesSquare,
  Bell,
  Search,
  Trash2,
  RefreshCw,
  LogOut,
  Send,
  Code,
  ArrowLeft,
  KeyRound,
  Shield,
  ShoppingBag,
  Package,
  Truck,
  Tag,
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Edit3,
  Image as ImageIcon,
  Upload,
  Ruler,
  CheckSquare,
  Square,
  X
} from 'lucide-react';

interface AdminDashboardProps {
  onBackToShop: () => void;
  onToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBackToShop, onToast }) => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(DB.admin.isLoggedIn());
  const [adminUser, setAdminUser] = useState<string>('admin');
  const [adminPass, setAdminPass] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');

  // Password change states (only accessible inside dashboard when logged in)
  const [isChangePassOpen, setIsChangePassOpen] = useState<boolean>(false);
  const [oldPassInput, setOldPassInput] = useState<string>('');
  const [newPassInput, setNewPassInput] = useState<string>('');
  const [confirmPassInput, setConfirmPassInput] = useState<string>('');
  const [passError, setPassError] = useState<string>('');

  const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'users' | 'chat' | 'json'>('products');
  const [userSearch, setUserSearch] = useState<string>('');
  const [orderSearch, setOrderSearch] = useState<string>('');
  const [productSearch, setProductSearch] = useState<string>('');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [adminReplyText, setAdminReplyText] = useState<string>('');

  // Data states
  const [ordersList, setOrdersList] = useState<Order[]>([]);
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [sessionsList, setSessionsList] = useState<ChatSession[]>([]);
  const [currentChatMsgs, setCurrentChatMsgs] = useState<ChatMessage[]>([]);
  const [jsonDump, setJsonDump] = useState<string>('');

  // Form states for adding/editing items to sell
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [pName, setPName] = useState<string>('');
  const [pPrice, setPPrice] = useState<string>('');
  const [pTag, setPTag] = useState<string>('Tee');
  const [pStock, setPStock] = useState<string>('20');
  const [pDesc, setPDesc] = useState<string>('');
  const [pImages, setPImages] = useState<string[]>([]);
  const [pImageUrlInput, setPImageUrlInput] = useState<string>('');
  const [pSizesCm, setPSizesCm] = useState<string>(
    'S: P 68cm, L 50cm\nM: P 70cm, L 52cm\nL: P 72cm, L 54cm\nXL: P 74cm, L 56cm\nXXL: P 76cm, L 58cm'
  );
  const [pShippingMethods, setPShippingMethods] = useState<string[]>([
    'Reseller All Item',
    'Pengiriman Reguler',
    'Pengiriman Express'
  ]);

  // Stats
  const [statUsers, setStatUsers] = useState<number>(0);
  const [statSessions, setStatSessions] = useState<number>(0);
  const [statMessages, setStatMessages] = useState<number>(0);
  const [statUnread, setStatUnread] = useState<number>(0);

  const fmtIDR = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');

  const syncData = () => {
    setIsLoggedIn(DB.admin.isLoggedIn());
    setOrdersList(DB.orders.getAll());
    setProductsList(DB.products.getAll());
    setUsersList(DB.users.getAll());

    const sess = DB.chat.getSessions();
    setSessionsList(sess);

    if (activeSessionId) {
      setCurrentChatMsgs(DB.chat.getMessages(activeSessionId));
    } else if (sess.length > 0 && !activeSessionId) {
      // Auto select first session if available
      setActiveSessionId(sess[0].session_id);
    }

    setStatUsers(DB.stats.userCount());
    setStatSessions(DB.stats.sessionCount());
    setStatMessages(DB.stats.messageCount());
    setStatUnread(DB.stats.unreadAdminCount());

    setJsonDump(JSON.stringify(DB.debug.dump(), null, 2));
  };

  // Helper for image compression to avoid large payload failures
  const compressImageFile = (file: File, maxWidth = 1000, quality = 0.85): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxWidth) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxWidth) / height);
              height = maxWidth;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
          } else {
            resolve((e.target?.result as string) || '');
          }
        };
        img.onerror = () => resolve((e.target?.result as string) || '');
        img.src = (e.target?.result as string) || '';
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  // Product Management Handlers
  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 5 - pImages.length;
    if (remainingSlots <= 0) {
      onToast('Maksimal 5 gambar per produk', 'error');
      return;
    }

    const filesToProcess = (Array.from(files) as File[]).slice(0, remainingSlots);
    for (const file of filesToProcess) {
      if (file.size > 10 * 1024 * 1024) {
        onToast(`File ${file.name} terlalu besar (Maks 10MB)`, 'error');
        continue;
      }
      try {
        const compressedBase64 = await compressImageFile(file);
        if (compressedBase64) {
          setPImages((prev) => (prev.length < 5 ? [...prev, compressedBase64] : prev));
        }
      } catch (err) {
        console.error('Failed to compress image:', err);
      }
    }
    e.target.value = '';
  };

  const handleAddImageUrl = () => {
    const trimmed = pImageUrlInput.trim();
    if (!trimmed) return;
    if (pImages.length >= 5) {
      onToast('Maksimal 5 gambar per produk', 'error');
      return;
    }
    setPImages((prev) => [...prev, trimmed]);
    setPImageUrlInput('');
    onToast('URL gambar ditambahkan', 'success');
  };

  const handleRemoveImage = (index: number) => {
    setPImages((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleToggleShippingMethod = (method: string) => {
    setPShippingMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]
    );
  };

  const handleResetProductForm = () => {
    setEditingProductId(null);
    setPName('');
    setPPrice('');
    setPTag('Tee');
    setPStock('20');
    setPDesc('');
    setPImages([]);
    setPImageUrlInput('');
    setPSizesCm('S: P 68cm, L 50cm\nM: P 70cm, L 52cm\nL: P 72cm, L 54cm\nXL: P 74cm, L 56cm\nXXL: P 76cm, L 58cm');
    setPShippingMethods(['Reseller All Item', 'Pengiriman Reguler', 'Pengiriman Express']);
  };

  const handleEditProduct = (prod: Product) => {
    setEditingProductId(prod.id);
    setPName(prod.name);
    setPPrice(prod.price.toString());
    setPTag(prod.tag || 'Tee');
    setPStock((prod.stock || 20).toString());
    setPDesc(prod.description || '');
    setPImages(prod.images && prod.images.length > 0 ? prod.images : [prod.img]);
    setPSizesCm(prod.sizes_cm || 'S: P 68cm, L 50cm\nM: P 70cm, L 52cm\nL: P 72cm, L 54cm\nXL: P 74cm, L 56cm\nXXL: P 76cm, L 58cm');
    setPShippingMethods(
      prod.shipping_methods || ['Reseller All Item', 'Pengiriman Reguler', 'Pengiriman Express']
    );
    setActiveTab('products');
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  const handleDeleteProduct = (id: string, name: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus produk "${name}"?`)) {
      DB.products.delete(id);
      onToast(`Produk ${name} berhasil dihapus!`, 'info');
      syncData();
    }
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pName.trim()) {
      onToast('Masukkan nama item yang ingin dijual', 'error');
      return;
    }
    if (!pPrice || Number(pPrice) <= 0) {
      onToast('Masukkan harga item yang valid', 'error');
      return;
    }
    if (pImages.length === 0) {
      onToast('Unggah minimal 1 gambar item (maksimal 5 file)', 'error');
      return;
    }

    DB.products.add({
      id: editingProductId || undefined,
      name: pName.trim(),
      price: Number(pPrice),
      img: pImages[0],
      images: pImages,
      tag: pTag.trim() || 'Tee',
      stock: Number(pStock) || 20,
      description: pDesc.trim(),
      sizes_cm: pSizesCm.trim(),
      shipping_methods: pShippingMethods.length > 0 ? pShippingMethods : ['Pengiriman Reguler']
    });

    onToast(editingProductId ? 'Item berhasil diperbarui!' : 'Item baru berhasil ditambahkan untuk dijual!', 'success');
    handleResetProductForm();
    syncData();
  };

  useEffect(() => {
    syncData();
    const unsubscribe = subscribeDB(syncData);
    const interval = setInterval(syncData, 1500);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [activeSessionId]);

  // Handle Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const res = DB.admin.login(adminUser, adminPass);
    if (!res.success) {
      setLoginError(res.message || 'Login gagal');
      return;
    }
    setLoginError('');
    setIsLoggedIn(true);
    onToast('Login Admin berhasil!', 'success');
  };

  const handleLogout = () => {
    DB.admin.logout();
    setIsLoggedIn(false);
    onToast('Admin telah logout', 'info');
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassInput !== confirmPassInput) {
      setPassError('Konfirmasi password baru tidak cocok');
      return;
    }
    const res = DB.admin.changePassword(oldPassInput, newPassInput);
    if (!res.success) {
      setPassError(res.message || 'Gagal mengubah password');
      return;
    }
    setPassError('');
    setIsChangePassOpen(false);
    setOldPassInput('');
    setNewPassInput('');
    setConfirmPassInput('');
    onToast('Password Admin berhasil diperbarui!', 'success');
  };

  // Handle User Deletion
  const handleDeleteUser = (email: string) => {
    if (window.confirm(`Hapus user verified ${email}?`)) {
      DB.users.deleteByEmail(email);
      onToast(`User ${email} telah dihapus`, 'info');
      syncData();
    }
  };

  const handleClearAllUsers = () => {
    if (window.confirm('Yakin ingin menghapus SEMUA user terdaftar?')) {
      DB.users.clearAll();
      onToast('Seluruh daftar user telah dibersihkan', 'info');
      syncData();
    }
  };

  // Handle Chat Session Selection & Reply
  const handleSelectSession = (sid: string) => {
    setActiveSessionId(sid);
    DB.chat.markRead(sid, 'admin');
    setCurrentChatMsgs(DB.chat.getMessages(sid));
  };

  const handleAdminSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSessionId || !adminReplyText.trim()) return;

    DB.chat.sendMessage({
      session_id: activeSessionId,
      sender: 'admin',
      text: adminReplyText.trim()
    });

    setAdminReplyText('');
    syncData();
  };

  const handleDeleteSession = () => {
    if (!activeSessionId) return;
    if (window.confirm('Hapus sesi chat CS ini beserta seluruh pesan historisnya?')) {
      DB.chat.deleteSession(activeSessionId);
      setActiveSessionId(null);
      onToast('Sesi chat berhasil dihapus', 'info');
      syncData();
    }
  };

  const handleResetAllData = () => {
    if (window.confirm('PERINGATAN: Reset SEMUA data database localStorage (Users, Chat, OTP, Session)?')) {
      DB.debug.resetAll();
      setActiveSessionId(null);
      onToast('Database localStorage berhasil direset', 'info');
      syncData();
    }
  };

  const handleUpdateOrderStatus = (orderId: string, status: 'pending' | 'paid' | 'cancelled') => {
    DB.orders.updateStatus(orderId, status);
    onToast(`Status pesanan ${orderId} diubah ke ${status.toUpperCase()}`, 'success');
    syncData();
  };

  // Filtered Orders
  const filteredOrders = ordersList.filter((o) => {
    const q = orderSearch.toLowerCase();
    const matchId = o.order_id.toLowerCase().includes(q);
    const matchName = o.name.toLowerCase().includes(q);
    const matchEmail = o.email.toLowerCase().includes(q);
    const matchPhone = (o.phone || '').toLowerCase().includes(q);
    const matchShip = (o.shipping_method || '').toLowerCase().includes(q);
    const matchItems = o.items.some(
      (i) => i.name.toLowerCase().includes(q) || (i.size || '').toLowerCase().includes(q)
    );
    return matchId || matchName || matchEmail || matchPhone || matchShip || matchItems;
  });

  // Filtered Users
  const filteredUsers = usersList.filter((u) => {
    const q = userSearch.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.address.toLowerCase().includes(q);
  });

  // Active Session Details
  const currentSession = sessionsList.find((s) => s.session_id === activeSessionId);

  if (!isLoggedIn) {
    return (
      <div
        data-testid="admin-login-view"
        className="min-h-[85vh] flex items-center justify-center px-4 bg-[#0a0a0a] text-[#f4f2ee]"
      >
        <div className="w-full max-w-sm bg-neutral-950 border border-neutral-800 rounded-lg p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="text-center space-y-1">
            <div className="inline-flex items-center gap-2 bg-[#e9ff00]/10 border border-[#e9ff00]/20 px-3 py-1 rounded text-[#e9ff00] font-mono-code text-[11px] uppercase tracking-widest">
              <Shield className="w-3.5 h-3.5" />
              <span>Admin Access</span>
            </div>
            <h2 className="font-display text-5xl text-[#f4f2ee] tracking-wider pt-2">
              NEXUS · DB
            </h2>
            <p className="text-xs font-mono-code text-neutral-400">
              Dashboard Managemen
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block font-mono-code text-[10px] uppercase text-neutral-400 mb-1">
                Username Admin
              </label>
              <input
                id="adminUser"
                data-testid="admin-username"
                type="text"
                value={adminUser}
                onChange={(e) => setAdminUser(e.target.value)}
                placeholder="admin"
                className="w-full bg-neutral-900 border border-neutral-800 text-white rounded px-3.5 py-2.5 font-mono-code text-sm focus:outline-none focus:border-[#e9ff00]"
              />
            </div>

            <div>
              <label className="block font-mono-code text-[10px] uppercase text-neutral-400 mb-1">
                Password
              </label>
              <input
                id="adminPass"
                data-testid="admin-password"
                type="password"
                value={adminPass}
                onChange={(e) => setAdminPass(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-neutral-900 border border-neutral-800 text-white rounded px-3.5 py-2.5 font-mono-code text-sm focus:outline-none focus:border-[#e9ff00]"
              />
            </div>

            {loginError && (
              <div
                id="loginErr"
                data-testid="admin-login-error"
                className="text-[#ff5a1f] font-mono-code text-xs bg-[#ff5a1f]/10 p-2.5 rounded border border-[#ff5a1f]/30"
              >
                {loginError}
              </div>
            )}

            <button
              id="adminLoginBtn"
              data-testid="admin-login-btn"
              type="submit"
              className="w-full bg-[#e9ff00] text-[#0a0a0a] hover:bg-[#d6f000] py-3 font-mono-code uppercase text-xs tracking-widest font-bold rounded transition-colors cursor-pointer"
            >
              Masuk Dashboard
            </button>
          </form>

          <div className="pt-2 border-t border-neutral-800 text-center">
            <button
              onClick={onBackToShop}
              data-testid="back-to-shop"
              className="inline-flex items-center gap-1.5 font-mono-code text-xs uppercase tracking-widest text-neutral-400 hover:text-[#e9ff00] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Store</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f4f2ee] pb-16">
      {/* Header */}
      <header className="border-b border-neutral-800 px-4 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-4 bg-neutral-950">
        <div className="flex items-center gap-3">
          <span className="font-display text-3xl sm:text-4xl tracking-wider text-[#e9ff00]">
            NEXUS · DB
          </span>
          <span className="font-mono-code text-[10px] uppercase tracking-widest text-neutral-400 border border-neutral-800 px-2 py-1 rounded">
            localStorage Panel
          </span>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <span
            id="adminWho"
            data-testid="admin-who"
            className="font-mono-code text-xs text-neutral-400 flex items-center gap-1.5"
          >
            <KeyRound className="w-3.5 h-3.5 text-[#e9ff00]" />
            <span>@admin</span>
          </span>

          <button
            onClick={() => {
              setIsChangePassOpen(true);
              setPassError('');
              setOldPassInput('');
              setNewPassInput('');
              setConfirmPassInput('');
            }}
            className="border border-[#e9ff00]/40 text-[#e9ff00] hover:bg-[#e9ff00] hover:text-[#0a0a0a] px-2.5 py-1.5 font-mono-code text-xs uppercase tracking-widest rounded flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Ganti Password</span>
          </button>

          <button
            onClick={onBackToShop}
            className="font-mono-code text-xs uppercase tracking-widest text-neutral-300 hover:text-[#e9ff00] transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Shop</span>
          </button>

          <button
            id="adminLogoutBtn"
            data-testid="admin-logout-btn"
            onClick={handleLogout}
            className="border border-neutral-700 hover:border-neutral-500 text-neutral-300 hover:text-white px-3 py-1.5 font-mono-code text-xs uppercase tracking-widest rounded flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-[#ff5a1f]" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* KPI Cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 py-6 grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 flex items-center justify-between">
          <div>
            <div className="font-mono-code text-[10px] uppercase tracking-widest text-neutral-400">
              Total Pesanan
            </div>
            <div
              id="statOrders"
              data-testid="stat-orders"
              className="font-display text-4xl mt-1 text-[#e9ff00]"
            >
              {ordersList.length}
            </div>
          </div>
          <ShoppingBag className="w-8 h-8 text-[#e9ff00]/70" />
        </div>

        <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 flex items-center justify-between">
          <div>
            <div className="font-mono-code text-[10px] uppercase tracking-widest text-neutral-400">
              Users Verified
            </div>
            <div
              id="statUsers"
              data-testid="stat-users"
              className="font-display text-4xl mt-1 text-white"
            >
              {statUsers}
            </div>
          </div>
          <Users className="w-8 h-8 text-neutral-600" />
        </div>

        <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 flex items-center justify-between">
          <div>
            <div className="font-mono-code text-[10px] uppercase tracking-widest text-neutral-400">
              Chat Sessions
            </div>
            <div
              id="statSessions"
              data-testid="stat-sessions"
              className="font-display text-4xl mt-1 text-white"
            >
              {statSessions}
            </div>
          </div>
          <MessageSquare className="w-8 h-8 text-neutral-600" />
        </div>

        <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 flex items-center justify-between">
          <div>
            <div className="font-mono-code text-[10px] uppercase tracking-widest text-neutral-400">
              Total Messages
            </div>
            <div
              id="statMessages"
              data-testid="stat-messages"
              className="font-display text-4xl mt-1 text-white"
            >
              {statMessages}
            </div>
          </div>
          <MessagesSquare className="w-8 h-8 text-neutral-600" />
        </div>

        <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 flex items-center justify-between">
          <div>
            <div className="font-mono-code text-[10px] uppercase tracking-widest text-neutral-400">
              Unread CS
            </div>
            <div
              id="statUnread"
              data-testid="stat-unread"
              className="font-display text-4xl mt-1 text-[#e9ff00]"
            >
              {statUnread}
            </div>
          </div>
          <Bell className="w-8 h-8 text-[#e9ff00]/60" />
        </div>
      </section>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="flex flex-wrap gap-2 border-b border-neutral-800 pb-3 font-mono-code text-xs uppercase tracking-widest">
          <button
            data-tab="products"
            data-testid="tab-products"
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2 rounded font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'products'
                ? 'bg-[#e9ff00] text-[#0a0a0a]'
                : 'bg-neutral-900 text-neutral-300 border border-neutral-800 hover:border-neutral-600'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Kelola Item / Produk ({productsList.length})</span>
          </button>

          <button
            data-tab="orders"
            data-testid="tab-orders"
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'orders'
                ? 'bg-[#e9ff00] text-[#0a0a0a]'
                : 'bg-neutral-900 text-neutral-300 border border-neutral-800 hover:border-neutral-600'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Pesanan / Transaksi ({ordersList.length})</span>
          </button>

          <button
            data-tab="users"
            data-testid="tab-users"
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'users'
                ? 'bg-[#e9ff00] text-[#0a0a0a]'
                : 'bg-neutral-900 text-neutral-300 border border-neutral-800 hover:border-neutral-600'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Users ({usersList.length})</span>
          </button>

          <button
            data-tab="chat"
            data-testid="tab-chat"
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-2 rounded font-bold transition-all flex items-center gap-2 relative cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-[#e9ff00] text-[#0a0a0a]'
                : 'bg-neutral-900 text-neutral-300 border border-neutral-800 hover:border-neutral-600'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat CS</span>
            {statUnread > 0 && (
              <span className="bg-[#ff5a1f] text-white font-mono-code font-bold text-[10px] px-1.5 py-0.2 rounded-full">
                {statUnread}
              </span>
            )}
          </button>

          <button
            data-tab="json"
            data-testid="tab-json"
            onClick={() => setActiveTab('json')}
            className={`px-4 py-2 rounded font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'json'
                ? 'bg-[#e9ff00] text-[#0a0a0a]'
                : 'bg-neutral-900 text-neutral-300 border border-neutral-800 hover:border-neutral-600'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>JSON View</span>
          </button>
        </div>
      </div>

      {/* PANEL 0: PRODUCTS MANAGEMENT */}
      {activeTab === 'products' && (
        <section id="panelProducts" className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-8">
          {/* FORM: INPUT ITEM YANG INGIN DIJUAL */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-6 space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
              <div>
                <div className="font-mono-code text-xs uppercase tracking-widest text-[#e9ff00] font-bold flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  <span>MANAJEMEN KATALOG BARANG</span>
                </div>
                <h3 className="font-display text-2xl text-white mt-1">
                  {editingProductId ? `Edit Item (#${editingProductId})` : 'Input Item Yang Ingin Dijual'}
                </h3>
              </div>
              {editingProductId && (
                <button
                  type="button"
                  onClick={handleResetProductForm}
                  className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-mono-code text-xs px-3 py-1.5 rounded flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Batal Edit</span>
                </button>
              )}
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-6">
              {/* Top Row: Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <label className="block font-mono-code text-xs uppercase tracking-wider text-neutral-300 font-semibold">
                    Nama Item <span className="text-[#ff5a1f]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={pName}
                    onChange={(e) => setPName(e.target.value)}
                    placeholder="Contoh: OVERSIZED TEE — INK"
                    className="w-full bg-neutral-900 border border-neutral-800 text-white rounded px-3.5 py-2.5 text-sm font-sans-body focus:outline-none focus:border-[#e9ff00]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-mono-code text-xs uppercase tracking-wider text-neutral-300 font-semibold">
                    Harga Item (Rp) <span className="text-[#ff5a1f]">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1000"
                    value={pPrice}
                    onChange={(e) => setPPrice(e.target.value)}
                    placeholder="189000"
                    className="w-full bg-neutral-900 border border-neutral-800 text-white font-mono-code rounded px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#e9ff00]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-mono-code text-xs uppercase tracking-wider text-neutral-300 font-semibold">
                    Kategori / Tag
                  </label>
                  <select
                    value={pTag}
                    onChange={(e) => setPTag(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 text-white rounded px-3.5 py-2.5 text-sm font-mono-code focus:outline-none focus:border-[#e9ff00] cursor-pointer"
                  >
                    <option value="Tee">Tee / Kaos</option>
                    <option value="Hoodie">Hoodie / Sweatshirt</option>
                    <option value="Denim">Denim / Celana</option>
                    <option value="Outer">Outer / Jaket</option>
                    <option value="Cap">Cap / Aksesoris Headwear</option>
                    <option value="Shirt">Shirt / Kemeja</option>
                    <option value="Sweater">Sweater</option>
                    <option value="Acc">Aksesoris / Tas</option>
                  </select>
                </div>
              </div>

              {/* UPLOAD GAMBAR ITEM (MAX 5 FILES) */}
              <div className="bg-neutral-900/60 border border-neutral-800 rounded-lg p-4 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div>
                    <label className="font-mono-code text-xs uppercase tracking-wider text-[#e9ff00] font-bold flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-[#e9ff00]" />
                      <span>Upload Gambar Item (Maksimal 5 File)</span>
                    </label>
                    <p className="text-xs text-neutral-400 mt-0.5 font-sans-body">
                      Pilih dari komputer/HP atau masukkan URL gambar. Gambar pertama akan menjadi foto utama.
                    </p>
                  </div>
                  <div className="font-mono-code text-xs font-bold px-2.5 py-1 rounded bg-neutral-800 text-white border border-neutral-700">
                    {pImages.length} / 5 File Terunggah
                  </div>
                </div>

                {/* Upload Action Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <label className="bg-[#e9ff00] hover:bg-[#d4ea00] text-[#0a0a0a] font-mono-code font-bold text-xs px-4 py-2.5 rounded flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm">
                    <Upload className="w-4 h-4" />
                    <span>Upload File Gambar (Pilih hingga 5 file)</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageFileUpload}
                      className="hidden"
                    />
                  </label>

                  <div className="flex-1 flex gap-2">
                    <input
                      type="url"
                      value={pImageUrlInput}
                      onChange={(e) => setPImageUrlInput(e.target.value)}
                      placeholder="Atau masukkan URL Gambar (https://...)"
                      className="flex-1 bg-neutral-950 border border-neutral-800 text-white rounded px-3 py-2 text-xs font-mono-code focus:outline-none focus:border-[#e9ff00]"
                    />
                    <button
                      type="button"
                      onClick={handleAddImageUrl}
                      className="bg-neutral-800 hover:bg-neutral-700 text-white font-mono-code text-xs px-3 py-2 rounded flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah URL</span>
                    </button>
                  </div>
                </div>

                {/* Thumbnails Grid (Up to 5) */}
                {pImages.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                    {pImages.map((imgSrc, idx) => (
                      <div
                        key={idx}
                        className="relative bg-neutral-950 border border-neutral-700 rounded overflow-hidden aspect-square group shadow-md"
                      >
                        <img src={imgSrc} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute top-1 left-1 bg-black/80 text-[#e9ff00] font-mono-code text-[10px] px-1.5 py-0.5 rounded border border-white/10 font-bold">
                          {idx === 0 ? '★ Utama' : `#${idx + 1}`}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="absolute top-1 right-1 bg-red-600 hover:bg-red-500 text-white p-1 rounded-full transition-colors cursor-pointer"
                          title="Hapus gambar ini"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border border-dashed border-neutral-800 rounded p-6 text-center text-neutral-500 font-mono-code text-xs">
                    Belum ada gambar yang diunggah. Silakan klik tombol Upload File di atas (maks 5 gambar).
                  </div>
                )}
              </div>

              {/* KETERANGAN ITEM / DESCRIPTION */}
              <div className="space-y-1">
                <label className="block font-mono-code text-xs uppercase tracking-wider text-neutral-300 font-semibold">
                  Keterangan Item / Deskripsi Detail
                </label>
                <textarea
                  rows={2}
                  value={pDesc}
                  onChange={(e) => setPDesc(e.target.value)}
                  placeholder="Bahan 100% Cotton combed 24s, lembut, nyaman, dan menyerap keringat dengan baik..."
                  className="w-full bg-neutral-900 border border-neutral-800 text-white rounded px-3.5 py-2.5 text-sm font-sans-body focus:outline-none focus:border-[#e9ff00]"
                />
              </div>

              {/* UKURAN ITEM DENGAN SATUAN CM */}
              <div className="bg-neutral-900/40 border border-neutral-800 rounded-lg p-4 space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <label className="font-mono-code text-xs uppercase tracking-wider text-[#e9ff00] font-bold flex items-center gap-1.5">
                    <Ruler className="w-4 h-4 text-[#e9ff00]" />
                    <span>Ukuran Item dengan Satuan (cm)</span>
                  </label>
                  <div className="flex flex-wrap gap-1 font-mono-code text-[10px]">
                    <span className="text-neutral-400 self-center">Preset Cepat:</span>
                    <button
                      type="button"
                      onClick={() =>
                        setPSizesCm('S: P 68cm, L 50cm\nM: P 70cm, L 52cm\nL: P 72cm, L 54cm\nXL: P 74cm, L 56cm\nXXL: P 76cm, L 58cm')
                      }
                      className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-2 py-1 rounded cursor-pointer"
                    >
                      Preset Kaos (cm)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPSizesCm('S: P 65cm, L 54cm\nM: P 68cm, L 57cm\nL: P 71cm, L 60cm\nXL: P 74cm, L 63cm\nXXL: P 77cm, L 66cm')
                      }
                      className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-2 py-1 rounded cursor-pointer"
                    >
                      Preset Outer/Hoodie (cm)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPSizesCm('28: P 100cm, LP 76cm\n30: P 102cm, LP 80cm\n32: P 104cm, LP 84cm\n34: P 106cm, LP 88cm')
                      }
                      className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-2 py-1 rounded cursor-pointer"
                    >
                      Preset Celana (cm)
                    </button>
                  </div>
                </div>

                <textarea
                  rows={3}
                  value={pSizesCm}
                  onChange={(e) => setPSizesCm(e.target.value)}
                  placeholder="S: P 68cm, L 50cm&#10;M: P 70cm, L 52cm&#10;L: P 72cm, L 54cm&#10;XL: P 74cm, L 56cm"
                  className="w-full bg-neutral-950 border border-neutral-800 text-[#e9ff00] font-mono-code rounded px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#e9ff00] leading-relaxed"
                />
                <p className="text-[11px] text-neutral-400 font-mono-code">
                  * Keterangan P = Panjang (cm), L = Lebar (cm), LD = Lingkar Dada (cm), LP = Lingkar Pinggang (cm).
                </p>
              </div>

              {/* METODE PENGIRIMAN YANG AKAN DIGUNAKAN */}
              <div className="bg-neutral-900/40 border border-neutral-800 rounded-lg p-4 space-y-3">
                <label className="font-mono-code text-xs uppercase tracking-wider text-[#e9ff00] font-bold flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-[#e9ff00]" />
                  <span>Metode Pengiriman Yang Akan Digunakan</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono-code text-xs">
                  {[
                    { id: 'Reseller All Item', label: 'Reseller All Item (Flat Rp 100.000)' },
                    { id: 'Pengiriman Reguler', label: 'Pengiriman Reguler (Rp 20.000 / Gratis > 800k)' },
                    { id: 'Pengiriman Express', label: 'Pengiriman Express / Kilat (Rp 125.000, 3-5 Hari)' }
                  ].map((m) => {
                    const isChecked = pShippingMethods.includes(m.id);
                    return (
                      <div
                        key={m.id}
                        onClick={() => handleToggleShippingMethod(m.id)}
                        className={`p-3 rounded border flex items-center gap-2.5 cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-neutral-900 border-[#e9ff00] text-white'
                            : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-[#e9ff00] shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-neutral-600 shrink-0" />
                        )}
                        <span className="leading-tight">{m.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleResetProductForm}
                  className="px-5 py-3 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-mono-code text-xs font-bold transition-all cursor-pointer border border-neutral-800"
                >
                  Reset Form
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 rounded bg-[#e9ff00] hover:bg-[#d4ea00] text-[#0a0a0a] font-mono-code font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-lg"
                >
                  <Plus className="w-4 h-4" />
                  <span>{editingProductId ? 'Update Item' : 'Simpan Item ke Katalog'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* CATALOG TABLE / GRID: DAFTAR ITEM UNTUK DIJUAL */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
              <div className="flex items-center gap-3">
                <Search className="w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Cari item dalam katalog admin..."
                  className="bg-neutral-900 border border-neutral-800 text-white rounded px-3 py-1.5 text-xs font-mono-code focus:outline-none focus:border-[#e9ff00] min-w-[240px]"
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono-code text-xs text-neutral-400">
                  Total: <strong className="text-white">{productsList.length} Item</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Reset semua barang katalog ke default?')) {
                      DB.products.resetToDefault();
                      onToast('Katalog produk direset ke default', 'success');
                      syncData();
                    }
                  }}
                  className="bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 px-3 py-1.5 rounded font-mono-code text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Reset Katalog Default</span>
                </button>
              </div>
            </div>

            {/* Product Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {productsList
                .filter(
                  (p) =>
                    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                    p.tag.toLowerCase().includes(productSearch.toLowerCase()) ||
                    p.id.toLowerCase().includes(productSearch.toLowerCase())
                )
                .map((prod) => {
                  const imgList = (prod.images && prod.images.length > 0) ? prod.images : [prod.img];
                  return (
                    <div
                      key={prod.id}
                      className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 flex flex-col justify-between gap-3 hover:border-neutral-700 transition-colors"
                    >
                      <div className="flex gap-3">
                        {/* Thumbnail */}
                        <div className="w-20 h-24 bg-neutral-950 rounded overflow-hidden relative shrink-0 border border-neutral-800">
                          <img src={prod.img} alt={prod.name} className="w-full h-full object-cover" />
                          <span className="absolute bottom-1 right-1 bg-black/80 text-[#e9ff00] font-mono-code text-[9px] px-1 rounded font-bold">
                            📷 {imgList.length}/5
                          </span>
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="bg-neutral-950 text-[#e9ff00] border border-[#e9ff00]/30 font-mono-code text-[10px] px-1.5 py-0.5 rounded uppercase font-bold">
                              {prod.tag}
                            </span>
                            <span className="font-mono-code text-[10px] text-neutral-500">ID: {prod.id}</span>
                          </div>

                          <h4 className="font-display text-lg text-white truncate">{prod.name}</h4>

                          <div className="font-mono-code text-sm font-bold text-[#e9ff00]">
                            {fmtIDR(prod.price)}
                          </div>

                          {prod.sizes_cm && (
                            <div className="font-mono-code text-[10px] text-neutral-400 truncate">
                              📏 {prod.sizes_cm.replace(/\n/g, ' | ')}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bottom Shipping & Controls */}
                      <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-1">
                          {(prod.shipping_methods || ['Reguler']).slice(0, 2).map((m, idx) => (
                            <span key={idx} className="bg-neutral-950 text-neutral-400 font-mono-code text-[9px] px-1.5 py-0.5 rounded border border-neutral-800">
                              🚚 {m}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleEditProduct(prod)}
                            className="bg-neutral-800 hover:bg-[#e9ff00] hover:text-black text-white px-2.5 py-1 rounded font-mono-code text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(prod.id, prod.name)}
                            className="bg-neutral-800 hover:bg-red-600 text-neutral-300 hover:text-white px-2.5 py-1 rounded font-mono-code text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </section>
      )}

      {/* PANEL 0: ORDERS */}
      {activeTab === 'orders' && (
        <section id="panelOrders" className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                id="orderSearch"
                data-testid="order-search"
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Cari ID Pesanan, Nama, Jenis/Ukuran Item, Metode Shipping..."
                className="w-full bg-neutral-950 border border-neutral-800 text-white rounded pl-9 pr-3 py-2 text-sm font-sans-body focus:outline-none focus:border-[#e9ff00]"
              />
            </div>
            <div className="font-mono-code text-xs text-neutral-400 self-center">
              Total {filteredOrders.length} pesanan terdaftar
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <div
              data-testid="orders-empty"
              className="border border-neutral-800 rounded-lg p-12 text-center text-neutral-500 font-mono-code text-xs uppercase tracking-widest bg-neutral-950"
            >
              Belum ada data pesanan masuk
            </div>
          ) : (
            <div className="space-y-4" data-testid="orders-list">
              {filteredOrders.map((ord) => {
                const sub = ord.subtotal || ord.items.reduce((s, i) => s + i.price * i.qty, 0);
                const tax = ord.ppn ?? Math.round(sub * 0.12);
                const shipFee = ord.shipping_fee ?? (ord.total - sub - tax);
                const shipMethod = ord.shipping_method || 'Reguler';

                return (
                  <div
                    key={ord.order_id}
                    data-testid={`order-card-${ord.order_id}`}
                    className="bg-neutral-950 border border-neutral-800 rounded-lg p-5 space-y-4 hover:border-neutral-700 transition-colors"
                  >
                    {/* Order Card Header */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="bg-[#e9ff00]/10 border border-[#e9ff00]/30 text-[#e9ff00] font-mono-code font-bold text-xs px-2.5 py-1 rounded flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5" />
                          <span>{ord.order_id}</span>
                        </div>
                        <div className="font-mono-code text-xs text-neutral-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-neutral-500" />
                          <span>{new Date(ord.created_at).toLocaleString('id-ID')}</span>
                        </div>
                      </div>

                      {/* Status Selector */}
                      <div className="flex items-center gap-2">
                        <span className="font-mono-code text-[11px] text-neutral-400 uppercase">Status:</span>
                        <select
                          value={ord.status}
                          onChange={(e) =>
                            handleUpdateOrderStatus(ord.order_id, e.target.value as 'pending' | 'paid' | 'cancelled')
                          }
                          className={`font-mono-code text-xs font-bold px-2.5 py-1 rounded border focus:outline-none cursor-pointer ${
                            ord.status === 'paid'
                              ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                              : ord.status === 'cancelled'
                              ? 'bg-rose-950 text-rose-400 border-rose-800'
                              : 'bg-amber-950 text-amber-400 border-amber-800'
                          }`}
                        >
                          <option value="paid">PAID / LUNAS</option>
                          <option value="pending">PENDING</option>
                          <option value="cancelled">CANCELLED</option>
                        </select>
                      </div>
                    </div>

                    {/* Customer Info & Shipping Method */}
                    <div className="grid md:grid-cols-2 gap-4 bg-neutral-900/50 p-3.5 rounded border border-neutral-800/80 text-xs font-mono-code">
                      <div className="space-y-1">
                        <div className="text-neutral-500 uppercase font-semibold text-[10px]">Detail Pembeli:</div>
                        <div className="text-white font-bold">{ord.name} ({ord.email})</div>
                        {ord.phone && (
                          <div className="flex items-center gap-2 pt-0.5">
                            <span className="text-neutral-400">WA: <strong className="text-emerald-400">{ord.phone}</strong></span>
                            <a
                              href={`https://wa.me/${ord.phone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1 transition-colors"
                            >
                              <span>Hubungi WA</span>
                            </a>
                          </div>
                        )}
                        <div className="text-neutral-400 truncate">{ord.address}</div>
                      </div>
                      <div className="space-y-1 md:border-l md:border-neutral-800 md:pl-4">
                        <div className="text-neutral-500 uppercase font-semibold text-[10px]">Metode Pengiriman:</div>
                        <div className="text-[#e9ff00] font-bold flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5" />
                          <span>{shipMethod}</span>
                        </div>
                        <div className="text-neutral-400">Ongkos Kirim: {fmtIDR(shipFee)}</div>
                      </div>
                    </div>

                    {/* Items Table - Detailed Item Name, Size, Price */}
                    <div>
                      <div className="font-mono-code text-[11px] uppercase tracking-wider text-neutral-400 font-semibold mb-2 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-[#e9ff00]" />
                        <span>Daftar Item Yang Dibeli:</span>
                      </div>
                      <div className="overflow-x-auto border border-neutral-800/80 rounded bg-neutral-900/40">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-neutral-900 font-mono-code text-[11px] text-neutral-400 uppercase border-b border-neutral-800">
                            <tr>
                              <th className="px-3.5 py-2">Jenis / Nama Item</th>
                              <th className="px-3.5 py-2">Ukuran (Size)</th>
                              <th className="px-3.5 py-2 text-center">Qty</th>
                              <th className="px-3.5 py-2 text-right">Harga Item</th>
                              <th className="px-3.5 py-2 text-right">Subtotal Item</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-800/60 font-mono-code text-neutral-300">
                            {ord.items.map((it, idx) => (
                              <tr key={idx} className="hover:bg-neutral-800/30">
                                <td className="px-3.5 py-2.5 font-sans-body font-medium text-white">
                                  {it.name}
                                </td>
                                <td className="px-3.5 py-2.5">
                                  <span className="bg-[#e9ff00] text-[#0a0a0a] font-bold px-2 py-0.5 rounded text-[10px]">
                                    {it.size || 'L'}
                                  </span>
                                </td>
                                <td className="px-3.5 py-2.5 text-center font-bold">{it.qty}</td>
                                <td className="px-3.5 py-2.5 text-right">{fmtIDR(it.price)}</td>
                                <td className="px-3.5 py-2.5 text-right font-bold text-white">
                                  {fmtIDR(it.price * it.qty)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Order Total Calculations */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-2 border-t border-neutral-800 font-mono-code text-xs gap-2">
                      <div className="flex items-center gap-3 text-neutral-400">
                        <span>Subtotal: <strong className="text-white">{fmtIDR(sub)}</strong></span>
                        <span>PPN 12%: <strong className="text-white">{fmtIDR(tax)}</strong></span>
                        <span>Ongkir: <strong className="text-white">{fmtIDR(shipFee)}</strong></span>
                      </div>
                      <div className="text-sm font-bold text-white flex items-center gap-2 bg-neutral-900 px-3 py-1.5 rounded border border-neutral-800">
                        <CreditCard className="w-4 h-4 text-[#e9ff00]" />
                        <span>Total Tagihan:</span>
                        <span className="text-[#e9ff00] text-base">{fmtIDR(ord.total)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* PANEL 1: USERS */}
      {activeTab === 'users' && (
        <section id="panelUsers" className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                id="userSearch"
                data-testid="user-search"
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Cari nama, email, atau alamat..."
                className="w-full bg-neutral-950 border border-neutral-800 text-white rounded pl-9 pr-3 py-2 text-sm font-sans-body focus:outline-none focus:border-[#e9ff00]"
              />
            </div>

            <button
              id="clearUsersBtn"
              data-testid="clear-users-btn"
              onClick={handleClearAllUsers}
              className="border border-[#ff5a1f] text-[#ff5a1f] hover:bg-[#ff5a1f] hover:text-white px-3.5 py-2 font-mono-code text-xs uppercase tracking-widest font-bold rounded transition-colors flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Semua User</span>
            </button>
          </div>

          <div className="overflow-x-auto border border-neutral-800 rounded-lg bg-neutral-950">
            <table className="w-full text-sm text-left text-neutral-300" data-testid="users-table">
              <thead className="bg-neutral-900 font-mono-code text-xs uppercase tracking-widest text-neutral-400 border-b border-neutral-800">
                <tr>
                  <th className="px-4 py-3.5">Nama</th>
                  <th className="px-4 py-3.5">Email Verified</th>
                  <th className="px-4 py-3.5">Alamat Pengiriman</th>
                  <th className="px-4 py-3.5">Waktu Verifikasi</th>
                  <th className="px-4 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody id="usersTbody" className="divide-y divide-neutral-800">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      data-testid="users-empty"
                      className="px-4 py-10 text-center text-neutral-500 font-mono-code text-xs uppercase tracking-widest"
                    >
                      Belum ada data user terverifikasi
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr
                      key={u.email}
                      data-testid={`user-row-${u.email}`}
                      className="hover:bg-neutral-900/60 transition-colors"
                    >
                      <td className="px-4 py-3.5 font-medium text-white">{u.name}</td>
                      <td className="px-4 py-3.5 font-mono-code text-xs text-[#e9ff00]">
                        {u.email}
                      </td>
                      <td className="px-4 py-3.5 text-neutral-400 max-w-xs truncate">
                        {u.address}
                      </td>
                      <td className="px-4 py-3.5 font-mono-code text-[11px] text-neutral-500">
                        {new Date(u.verified_at).toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          data-del={u.email}
                          data-testid={`delete-user-${u.email}`}
                          onClick={() => handleDeleteUser(u.email)}
                          className="text-[#ff5a1f] hover:underline font-mono-code text-xs uppercase font-bold tracking-wider"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* PANEL 2: CHAT CS */}
      {activeTab === 'chat' && (
        <section
          id="panelChat"
          className="max-w-7xl mx-auto px-4 sm:px-8 py-6 grid md:grid-cols-12 gap-4"
        >
          {/* Session List */}
          <aside className="md:col-span-4 border border-neutral-800 rounded-lg bg-neutral-950 overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-800 font-mono-code text-xs uppercase tracking-widest text-neutral-400 font-bold bg-neutral-900">
              Sesi Chat Customer
            </div>
            <div id="sessionList" data-testid="session-list" className="max-h-[520px] overflow-y-auto divide-y divide-neutral-900">
              {sessionsList.length === 0 ? (
                <div
                  data-testid="sessions-empty"
                  className="p-8 text-neutral-500 font-mono-code text-xs uppercase tracking-widest text-center"
                >
                  Belum ada sesi chat masuk
                </div>
              ) : (
                sessionsList.map((s) => {
                  const isActive = s.session_id === activeSessionId;
                  return (
                    <button
                      key={s.session_id}
                      data-sid={s.session_id}
                      data-testid={`session-item-${s.session_id}`}
                      onClick={() => handleSelectSession(s.session_id)}
                      className={`w-full text-left p-3.5 transition-colors flex flex-col space-y-1 ${
                        isActive
                          ? 'bg-neutral-800/90 border-l-4 border-[#e9ff00]'
                          : 'hover:bg-neutral-900'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-white text-sm truncate">
                          {s.user_name || 'Anonim'}
                        </span>
                        {s.unread_admin > 0 && (
                          <span
                            data-testid={`unread-badge-${s.session_id}`}
                            className="bg-[#e9ff00] text-[#0a0a0a] font-mono-code font-bold text-[10px] px-2 py-0.5 rounded-full"
                          >
                            {s.unread_admin}
                          </span>
                        )}
                      </div>
                      <div className="font-mono-code text-[11px] text-neutral-400 truncate">
                        {s.user_email || '-'}
                      </div>
                      <div className="text-xs text-neutral-500 truncate pt-0.5">
                        {s.last_message || '...'}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Chat Room */}
          <div className="md:col-span-8 border border-neutral-800 rounded-lg bg-neutral-950 overflow-hidden flex flex-col min-h-[520px]">
            {/* Room Header */}
            <div
              id="chatHeaderAdmin"
              className="px-5 py-3.5 border-b border-neutral-800 bg-neutral-900 flex items-center justify-between"
            >
              <div>
                <div
                  id="chatHeaderName"
                  data-testid="admin-chat-header-name"
                  className="font-display text-2xl text-white tracking-wider"
                >
                  {currentSession ? currentSession.user_name : 'Pilih Sesi Chat'}
                </div>
                <div id="chatHeaderMeta" className="font-mono-code text-[11px] text-neutral-400">
                  {currentSession ? `${currentSession.user_email} · sid: ${currentSession.session_id}` : ''}
                </div>
              </div>

              {activeSessionId && (
                <button
                  id="deleteSessionBtn"
                  data-testid="delete-session-btn"
                  onClick={handleDeleteSession}
                  className="border border-[#ff5a1f] text-[#ff5a1f] hover:bg-[#ff5a1f] hover:text-white px-3 py-1.5 font-mono-code text-xs uppercase tracking-widest rounded transition-colors flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Sesi</span>
                </button>
              )}
            </div>

            {/* Messages Body */}
            <div
              id="chatMessagesAdmin"
              data-testid="admin-chat-messages"
              className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-neutral-950"
            >
              {!activeSessionId ? (
                <div
                  data-testid="admin-chat-hint"
                  className="text-neutral-500 font-mono-code text-xs uppercase tracking-widest text-center py-24"
                >
                  Pilih sesi dari daftar di sebelah kiri untuk mulai membalas pesan.
                </div>
              ) : currentChatMsgs.length === 0 ? (
                <div className="text-neutral-500 font-mono-code text-xs text-center py-12">
                  Belum ada pesan dalam sesi ini.
                </div>
              ) : (
                currentChatMsgs.map((m) => {
                  const isAdmin = m.sender === 'admin';
                  return (
                    <div
                      key={m.id}
                      className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        data-testid={`admin-msg-${m.sender}`}
                        className={`max-w-[75%] px-3.5 py-2.5 rounded-lg text-sm ${
                          isAdmin
                            ? 'bg-[#e9ff00] text-[#0a0a0a] font-medium'
                            : 'bg-neutral-800 text-white'
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{m.text}</div>
                        <div className="font-mono-code text-[9px] opacity-70 mt-1 text-right">
                          {new Date(m.timestamp).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Admin Input Form */}
            {activeSessionId && (
              <form
                id="adminChatForm"
                data-testid="admin-chat-form"
                onSubmit={handleAdminSendChat}
                className="border-t border-neutral-800 p-3 flex gap-2 bg-neutral-900"
              >
                <input
                  id="adminChatInput"
                  data-testid="admin-chat-input"
                  type="text"
                  value={adminReplyText}
                  onChange={(e) => setAdminReplyText(e.target.value)}
                  placeholder="Balas sebagai Admin CS NEXUS..."
                  className="flex-1 bg-neutral-950 border border-neutral-800 text-white rounded px-3.5 py-2 text-sm font-sans-body focus:outline-none focus:border-[#e9ff00]"
                />
                <button
                  type="submit"
                  data-testid="admin-chat-send"
                  className="bg-[#e9ff00] text-[#0a0a0a] hover:bg-[#d6f000] px-4 font-mono-code uppercase text-xs tracking-widest font-bold rounded flex items-center gap-1.5 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </form>
            )}
          </div>
        </section>
      )}

      {/* PANEL 3: JSON DUMP */}
      {activeTab === 'json' && (
        <section id="panelJson" className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-4">
          <div className="flex items-center gap-3">
            <button
              id="dumpBtn"
              data-testid="json-dump-btn"
              onClick={syncData}
              className="border border-neutral-700 hover:border-neutral-500 px-3.5 py-2 font-mono-code text-xs uppercase tracking-widest rounded flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#e9ff00]" />
              <span>Refresh Dump</span>
            </button>

            <button
              id="resetAllBtn"
              data-testid="json-reset-btn"
              onClick={handleResetAllData}
              className="border border-[#ff5a1f] text-[#ff5a1f] hover:bg-[#ff5a1f] hover:text-white px-3.5 py-2 font-mono-code text-xs uppercase tracking-widest font-bold rounded transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset Semua Data DB</span>
            </button>
          </div>

          <pre
            id="jsonDump"
            data-testid="json-dump"
            className="bg-neutral-950 border border-neutral-800 rounded-lg p-5 font-mono-code text-xs text-[#e9ff00] overflow-x-auto max-h-[560px] overflow-y-auto leading-relaxed"
          >
            {jsonDump}
          </pre>
        </section>
      )}

      {/* Change Password Modal */}
      {isChangePassOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-950 border border-neutral-800 rounded-lg max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2 text-[#e9ff00]">
                <KeyRound className="w-5 h-5" />
                <h3 className="font-display text-2xl tracking-wider text-white">GANTI PASSWORD ADMIN</h3>
              </div>
              <button
                onClick={() => setIsChangePassOpen(false)}
                className="text-neutral-400 hover:text-white font-mono-code text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4 font-sans-body">
              <div>
                <label className="block font-mono-code text-[11px] uppercase text-neutral-400 mb-1 font-semibold">
                  Password Saat Ini
                </label>
                <input
                  type="password"
                  value={oldPassInput}
                  onChange={(e) => setOldPassInput(e.target.value)}
                  placeholder="Password lama"
                  required
                  className="w-full bg-neutral-900 border border-neutral-800 text-white rounded px-3.5 py-2.5 font-mono-code text-sm focus:outline-none focus:border-[#e9ff00]"
                />
              </div>

              <div>
                <label className="block font-mono-code text-[11px] uppercase text-neutral-400 mb-1 font-semibold">
                  Password Baru
                </label>
                <input
                  type="password"
                  value={newPassInput}
                  onChange={(e) => setNewPassInput(e.target.value)}
                  placeholder="Minimal 4 karakter"
                  required
                  className="w-full bg-neutral-900 border border-neutral-800 text-white rounded px-3.5 py-2.5 font-mono-code text-sm focus:outline-none focus:border-[#e9ff00]"
                />
              </div>

              <div>
                <label className="block font-mono-code text-[11px] uppercase text-neutral-400 mb-1 font-semibold">
                  Konfirmasi Password Baru
                </label>
                <input
                  type="password"
                  value={confirmPassInput}
                  onChange={(e) => setConfirmPassInput(e.target.value)}
                  placeholder="Ulangi password baru"
                  required
                  className="w-full bg-neutral-900 border border-neutral-800 text-white rounded px-3.5 py-2.5 font-mono-code text-sm focus:outline-none focus:border-[#e9ff00]"
                />
              </div>

              {passError && (
                <div className="text-[#ff5a1f] font-mono-code text-xs bg-[#ff5a1f]/10 p-2.5 rounded border border-[#ff5a1f]/30">
                  {passError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-[#e9ff00] text-[#0a0a0a] hover:bg-[#d6f000] py-3 font-mono-code uppercase text-xs tracking-widest font-bold rounded transition-colors cursor-pointer"
                >
                  Simpan Password
                </button>
                <button
                  type="button"
                  onClick={() => setIsChangePassOpen(false)}
                  className="border border-neutral-700 text-neutral-400 hover:text-white px-4 py-3 font-mono-code uppercase text-xs rounded transition-colors"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
