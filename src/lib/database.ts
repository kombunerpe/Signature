import { User, ChatMessage, ChatSession, OtpRecord, Order, Product } from '../types';
import { INITIAL_PRODUCTS } from './products';

const STORAGE_KEYS = {
  USERS: 'nexus_users',
  CHAT_MESSAGES: 'nexus_chat_messages',
  CHAT_SESSIONS: 'nexus_chat_sessions',
  OTPS: 'nexus_otps',
  CURRENT_USER: 'nexus_current_user',
  ADMIN_SESSION: 'nexus_admin_session',
  ADMIN_PASS: 'nexus_admin_pass',
  ORDERS: 'nexus_orders',
  PRODUCTS: 'nexus_products',
  CURRENT_CHAT_SID: 'nexus_chat_sid'
};

// Event listener mechanism for live tab/state sync
type DBListener = () => void;
const listeners: Set<DBListener> = new Set();

export function subscribeDB(listener: DBListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners() {
  listeners.forEach((l) => l());
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nexus_db_updated'));
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', () => {
    notifyListeners();
  });
  window.addEventListener('nexus_db_updated', () => {
    // handled
  });
}

// Helper to safely parse localStorage
function getLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error(`Failed to read ${key} from localStorage`, e);
    return fallback;
  }
}

function setLocal<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    notifyListeners();
  } catch (e) {
    console.error(`Failed to set ${key} in localStorage`, e);
  }
}

// Background sync with Express server for cross-browser & cross-device persistence
let isSyncing = false;
async function fetchServerState() {
  if (typeof window === 'undefined' || isSyncing) return;
  isSyncing = true;
  try {
    const res = await fetch('/api/db/state');
    if (res.ok) {
      const data = await res.json();
      let changed = false;

      if (data.admin_pass && data.admin_pass !== getLocal(STORAGE_KEYS.ADMIN_PASS, 'admin123')) {
        localStorage.setItem(STORAGE_KEYS.ADMIN_PASS, JSON.stringify(data.admin_pass));
        changed = true;
      }
      if (data.users && JSON.stringify(data.users) !== JSON.stringify(getLocal(STORAGE_KEYS.USERS, []))) {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(data.users));
        changed = true;
      }
      if (data.chat_sessions && JSON.stringify(data.chat_sessions) !== JSON.stringify(getLocal(STORAGE_KEYS.CHAT_SESSIONS, []))) {
        localStorage.setItem(STORAGE_KEYS.CHAT_SESSIONS, JSON.stringify(data.chat_sessions));
        changed = true;
      }
      if (data.chat_messages && JSON.stringify(data.chat_messages) !== JSON.stringify(getLocal(STORAGE_KEYS.CHAT_MESSAGES, []))) {
        localStorage.setItem(STORAGE_KEYS.CHAT_MESSAGES, JSON.stringify(data.chat_messages));
        changed = true;
      }
      if (data.otps && JSON.stringify(data.otps) !== JSON.stringify(getLocal(STORAGE_KEYS.OTPS, []))) {
        localStorage.setItem(STORAGE_KEYS.OTPS, JSON.stringify(data.otps));
        changed = true;
      }
      if (data.orders && JSON.stringify(data.orders) !== JSON.stringify(getLocal(STORAGE_KEYS.ORDERS, []))) {
        localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(data.orders));
        changed = true;
      }
      if (data.products && Array.isArray(data.products) && data.products.length > 0 && JSON.stringify(data.products) !== JSON.stringify(getLocal(STORAGE_KEYS.PRODUCTS, []))) {
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(data.products));
        changed = true;
      }

      if (changed) {
        notifyListeners();
      }
    }
  } catch (e) {
    // Network or offline fallback
  } finally {
    isSyncing = false;
  }
}

if (typeof window !== 'undefined') {
  fetchServerState();
  setInterval(fetchServerState, 1200);
}

// Database module
export const DB = {
  users: {
    getAll(): User[] {
      return getLocal<User[]>(STORAGE_KEYS.USERS, []);
    },
    getByEmail(email: string): User | undefined {
      const all = this.getAll();
      return all.find((u) => u.email.toLowerCase() === email.toLowerCase());
    },
    add(user: { name: string; email: string; address: string }): User {
      const all = this.getAll();
      const existingIndex = all.findIndex((u) => u.email.toLowerCase() === user.email.toLowerCase());
      const now = new Date().toISOString();
      const newUser: User = {
        name: user.name,
        email: user.email.toLowerCase(),
        address: user.address,
        verified_at: now
      };

      if (existingIndex >= 0) {
        all[existingIndex] = newUser;
      } else {
        all.unshift(newUser);
      }
      setLocal(STORAGE_KEYS.USERS, all);

      // Async sync to server
      fetch('/api/db/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      }).then(() => fetchServerState()).catch(() => {});

      return newUser;
    },
    deleteByEmail(email: string): void {
      const all = this.getAll();
      const filtered = all.filter((u) => u.email.toLowerCase() !== email.toLowerCase());
      setLocal(STORAGE_KEYS.USERS, filtered);

      fetch(`/api/db/users/${encodeURIComponent(email)}`, {
        method: 'DELETE'
      }).then(() => fetchServerState()).catch(() => {});
    },
    clearAll(): void {
      setLocal(STORAGE_KEYS.USERS, []);
      fetch('/api/db/users', {
        method: 'DELETE'
      }).then(() => fetchServerState()).catch(() => {});
    }
  },

  email: {
    getOtps(): OtpRecord[] {
      return getLocal<OtpRecord[]>(STORAGE_KEYS.OTPS, []);
    },
    generateOTP(email: string): string {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const otps = this.getOtps().filter((o) => o.email.toLowerCase() !== email.toLowerCase());
      const record: OtpRecord = {
        email: email.toLowerCase(),
        code,
        created_at: Date.now(),
        expires_at: Date.now() + 10 * 60 * 1000 // 10 minutes
      };
      otps.push(record);
      setLocal(STORAGE_KEYS.OTPS, otps);

      fetch('/api/db/otp/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      }).then(() => fetchServerState()).catch(() => {});

      return code;
    },
    getLatestOTP(email: string): OtpRecord | undefined {
      const otps = this.getOtps();
      return otps.find((o) => o.email.toLowerCase() === email.toLowerCase());
    },
    verifyOTP(email: string, code: string): { valid: boolean; reason?: string } {
      const otps = this.getOtps();
      const record = otps.find((o) => o.email.toLowerCase() === email.toLowerCase());
      if (!record) {
        return { valid: false, reason: 'Kode OTP tidak ditemukan. Silakan kirim ulang.' };
      }
      if (Date.now() > record.expires_at) {
        return { valid: false, reason: 'Kode OTP sudah kedaluwarsa. Silakan minta kode baru.' };
      }
      if (record.code.trim() !== code.trim()) {
        return { valid: false, reason: 'Kode OTP salah. Periksa kembali 6 digit angka.' };
      }
      // Clean up used OTP
      const filtered = otps.filter((o) => o.email.toLowerCase() !== email.toLowerCase());
      setLocal(STORAGE_KEYS.OTPS, filtered);

      fetch('/api/db/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      }).then(() => fetchServerState()).catch(() => {});

      return { valid: true };
    }
  },

  chat: {
    getSessions(): ChatSession[] {
      return getLocal<ChatSession[]>(STORAGE_KEYS.CHAT_SESSIONS, []);
    },
    getMessages(session_id: string): ChatMessage[] {
      const allMsgs = getLocal<ChatMessage[]>(STORAGE_KEYS.CHAT_MESSAGES, []);
      return allMsgs.filter((m) => m.session_id === session_id);
    },
    sendMessage(params: {
      session_id: string;
      sender: 'user' | 'admin';
      text: string;
      user_name?: string;
      user_email?: string;
    }): ChatMessage {
      const { session_id, sender, text, user_name, user_email } = params;
      const allMsgs = getLocal<ChatMessage[]>(STORAGE_KEYS.CHAT_MESSAGES, []);
      const newMsg: ChatMessage = {
        id: 'msg_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
        session_id,
        sender,
        text,
        timestamp: new Date().toISOString(),
        user_name,
        user_email
      };
      allMsgs.push(newMsg);
      setLocal(STORAGE_KEYS.CHAT_MESSAGES, allMsgs);

      // Update or create chat session
      const sessions = this.getSessions();
      let session = sessions.find((s) => s.session_id === session_id);
      if (!session) {
        session = {
          session_id,
          user_name: user_name || 'Tamu',
          user_email: user_email || '-',
          last_message: text,
          last_updated: new Date().toISOString(),
          unread_admin: sender === 'user' ? 1 : 0,
          unread_user: sender === 'admin' ? 1 : 0
        };
        sessions.unshift(session);
      } else {
        session.last_message = text;
        session.last_updated = new Date().toISOString();
        if (user_name && user_name !== 'Tamu') session.user_name = user_name;
        if (user_email) session.user_email = user_email;
        if (sender === 'user') {
          session.unread_admin = (session.unread_admin || 0) + 1;
        } else {
          session.unread_user = (session.unread_user || 0) + 1;
        }
      }
      setLocal(STORAGE_KEYS.CHAT_SESSIONS, sessions);

      // Send to server endpoint
      fetch('/api/db/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      }).then(() => fetchServerState()).catch(() => {});

      return newMsg;
    },
    markRead(session_id: string, side: 'admin' | 'user' = 'admin'): void {
      const sessions = this.getSessions();
      const session = sessions.find((s) => s.session_id === session_id);
      if (session) {
        if (side === 'admin') session.unread_admin = 0;
        if (side === 'user') session.unread_user = 0;
        setLocal(STORAGE_KEYS.CHAT_SESSIONS, sessions);
      }

      fetch('/api/db/chat/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id, side })
      }).then(() => fetchServerState()).catch(() => {});
    },
    deleteSession(session_id: string): void {
      const sessions = this.getSessions().filter((s) => s.session_id !== session_id);
      setLocal(STORAGE_KEYS.CHAT_SESSIONS, sessions);

      const msgs = getLocal<ChatMessage[]>(STORAGE_KEYS.CHAT_MESSAGES, []).filter(
        (m) => m.session_id !== session_id
      );
      setLocal(STORAGE_KEYS.CHAT_MESSAGES, msgs);

      fetch(`/api/db/chat/sessions/${encodeURIComponent(session_id)}`, {
        method: 'DELETE'
      }).then(() => fetchServerState()).catch(() => {});
    }
  },

  orders: {
    getAll(): Order[] {
      return getLocal<Order[]>(STORAGE_KEYS.ORDERS, []);
    },
    create(order: Omit<Order, 'created_at'>): Order {
      const all = this.getAll();
      const newOrder: Order = {
        ...order,
        created_at: new Date().toISOString()
      };
      all.unshift(newOrder);
      setLocal(STORAGE_KEYS.ORDERS, all);

      fetch('/api/db/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrder)
      }).then(() => fetchServerState()).catch(() => {});

      return newOrder;
    },
    updateStatus(order_id: string, status: 'pending' | 'paid' | 'cancelled'): void {
      const all = this.getAll();
      const order = all.find((o) => o.order_id === order_id);
      if (order) {
        order.status = status;
        setLocal(STORAGE_KEYS.ORDERS, all);
      }

      fetch(`/api/db/orders/${encodeURIComponent(order_id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      }).then(() => fetchServerState()).catch(() => {});
    }
  },

  products: {
    getAll(): Product[] {
      const stored = getLocal<Product[] | null>(STORAGE_KEYS.PRODUCTS, null);
      if (!stored || stored.length === 0) {
        return INITIAL_PRODUCTS;
      }
      return stored;
    },
    saveAll(list: Product[]): void {
      setLocal(STORAGE_KEYS.PRODUCTS, list);
    },
    add(product: Omit<Product, 'id'> & { id?: string }): Product {
      const all = this.getAll();
      const id = product.id || 'ITEM-' + Date.now().toString(36).toUpperCase();
      const newProduct: Product = {
        ...product,
        id,
        img: product.img || (product.images && product.images[0]) || 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=700&q=70',
        images: product.images && product.images.length > 0 ? product.images : [product.img || 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=700&q=70']
      };

      const idx = all.findIndex((p) => p.id === id);
      if (idx >= 0) {
        all[idx] = newProduct;
      } else {
        all.unshift(newProduct);
      }
      setLocal(STORAGE_KEYS.PRODUCTS, all);

      if (typeof window !== 'undefined') {
        fetch('/api/db/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newProduct)
        }).then(() => fetchServerState()).catch(() => {});
      }

      return newProduct;
    },
    delete(id: string): void {
      const all = this.getAll().filter((p) => p.id !== id);
      setLocal(STORAGE_KEYS.PRODUCTS, all);

      if (typeof window !== 'undefined') {
        fetch('/api/db/products/' + encodeURIComponent(id), {
          method: 'DELETE'
        }).then(() => fetchServerState()).catch(() => {});
      }
    },
    resetToDefault(): void {
      setLocal(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);

      if (typeof window !== 'undefined') {
        fetch('/api/db/products/reset', {
          method: 'POST'
        }).then(() => fetchServerState()).catch(() => {});
      }
    }
  },

  session: {
    getCurrentUser(): User | null {
      return getLocal<User | null>(STORAGE_KEYS.CURRENT_USER, null);
    },
    setCurrentUser(user: Partial<User> | null): void {
      if (!user) {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        notifyListeners();
        return;
      }
      const existing = this.getCurrentUser() || {};
      const updated = { ...existing, ...user };
      setLocal(STORAGE_KEYS.CURRENT_USER, updated);
    },
    getOrCreateChatSessionId(): string {
      let sid = localStorage.getItem(STORAGE_KEYS.CURRENT_CHAT_SID);
      if (!sid) {
        sid = 'sid_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
        localStorage.setItem(STORAGE_KEYS.CURRENT_CHAT_SID, sid);
      }
      return sid;
    }
  },

  admin: {
    getPassword(): string {
      return getLocal<string>(STORAGE_KEYS.ADMIN_PASS, 'admin123');
    },
    isLoggedIn(): boolean {
      const session = getLocal<{ username: string; logged_in: boolean } | null>(
        STORAGE_KEYS.ADMIN_SESSION,
        null
      );
      return Boolean(session?.logged_in);
    },
    currentAdmin(): { username: string } | null {
      const session = getLocal<{ username: string; logged_in: boolean } | null>(
        STORAGE_KEYS.ADMIN_SESSION,
        null
      );
      return session?.logged_in ? { username: session.username } : null;
    },
    login(username: string, pass: string): { success: boolean; message?: string } {
      const currentPass = this.getPassword();
      if ((username === 'admin' || username === 'admin@nexus.com' || username === 'admin@3second.com') && pass === currentPass) {
        setLocal(STORAGE_KEYS.ADMIN_SESSION, { username, logged_in: true });
        return { success: true };
      }
      return { success: false, message: 'Username atau password salah, silakan hubungi admin' };
    },
    changePassword(oldPass: string, newPass: string): { success: boolean; message?: string } {
      const currentPass = this.getPassword();
      if (oldPass !== currentPass) {
        return { success: false, message: 'Password lama tidak sesuai' };
      }
      if (!newPass || newPass.trim().length < 4) {
        return { success: false, message: 'Password baru minimal 4 karakter' };
      }
      const trimmed = newPass.trim();
      setLocal(STORAGE_KEYS.ADMIN_PASS, trimmed);

      fetch('/api/db/admin-pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pass: trimmed })
      }).then(() => fetchServerState()).catch(() => {});

      return { success: true, message: 'Password admin berhasil diubah!' };
    },
    resetPassword(newPass: string): { success: boolean; message?: string } {
      if (!newPass || newPass.trim().length < 4) {
        return { success: false, message: 'Password baru minimal 4 karakter' };
      }
      const trimmed = newPass.trim();
      setLocal(STORAGE_KEYS.ADMIN_PASS, trimmed);

      fetch('/api/db/admin-pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pass: trimmed })
      }).then(() => fetchServerState()).catch(() => {});

      return { success: true, message: 'Password admin berhasil diperbarui!' };
    },
    logout(): void {
      localStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION);
      notifyListeners();
    }
  },

  stats: {
    userCount(): number {
      return DB.users.getAll().length;
    },
    sessionCount(): number {
      return DB.chat.getSessions().length;
    },
    messageCount(): number {
      return getLocal<ChatMessage[]>(STORAGE_KEYS.CHAT_MESSAGES, []).length;
    },
    unreadAdminCount(): number {
      return DB.chat.getSessions().reduce((s, x) => s + (x.unread_admin || 0), 0);
    }
  },

  debug: {
    dump(): Record<string, unknown> {
      return {
        users: DB.users.getAll(),
        chat_sessions: DB.chat.getSessions(),
        chat_messages: getLocal<ChatMessage[]>(STORAGE_KEYS.CHAT_MESSAGES, []),
        otps: DB.email.getOtps(),
        orders: DB.orders.getAll(),
        current_user: DB.session.getCurrentUser(),
        admin_session: getLocal(STORAGE_KEYS.ADMIN_SESSION, null)
      };
    },
    resetAll(): void {
      Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
      notifyListeners();

      fetch('/api/db/reset', { method: 'POST' }).then(() => fetchServerState()).catch(() => {});
    }
  }
};

