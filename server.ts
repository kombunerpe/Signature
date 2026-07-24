import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { INITIAL_PRODUCTS } from "./src/lib/products";
import { Product } from "./src/types";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Ensure production keys are used even if process.env contains old Sandbox keys
const envMerchantId = process.env.MIDTRANS_MERCHANT_ID;
const MIDTRANS_MERCHANT_ID = envMerchantId || "";

const envClientKey = process.env.VITE_MIDTRANS_CLIENT_KEY;
const MIDTRANS_CLIENT_KEY = (envClientKey && !envClientKey.startsWith("SB-")) ? envClientKey : "";

const envServerKey = process.env.MIDTRANS_SERVER_KEY;
const MIDTRANS_SERVER_KEY = (envServerKey && !envServerKey.startsWith("SB-")) ? envServerKey : "";

// Server-side persistent database
interface ServerDBData {
  admin_pass?: string;
  users: Array<{ name: string; email: string; address: string; verified_at: string }>;
  chat_sessions: Array<{
    session_id: string;
    user_name: string;
    user_email: string;
    last_message: string;
    last_updated: string;
    unread_admin: number;
    unread_user: number;
  }>;
  chat_messages: Array<{
    id: string;
    session_id: string;
    sender: 'user' | 'admin';
    text: string;
    timestamp: string;
    user_name?: string;
    user_email?: string;
  }>;
  otps: Array<{
    email: string;
    code: string;
    created_at: number;
    expires_at: number;
  }>;
  orders: Array<{
    order_id: string;
    email: string;
    name: string;
    address: string;
    items: Array<{ id: string; name: string; qty: number; price: number }>;
    total: number;
    status: 'pending' | 'paid' | 'cancelled';
    created_at: string;
  }>;
  products?: Product[];
}

const DB_FILE_PATH = path.join(process.cwd(), "data_db.json");

function loadServerDB(): ServerDBData {
  let dbData: ServerDBData = {
    admin_pass: "admin123",
    users: [],
    chat_sessions: [],
    chat_messages: [],
    otps: [],
    orders: [],
    products: INITIAL_PRODUCTS
  };
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const content = fs.readFileSync(DB_FILE_PATH, "utf-8");
      const parsed = JSON.parse(content);
      dbData = { ...dbData, ...parsed };
      if (!dbData.products || dbData.products.length === 0) {
        dbData.products = INITIAL_PRODUCTS;
      }
    }
  } catch (e) {
    console.error("Failed to load server DB file:", e);
  }
  return dbData;
}

function saveServerDB(data: ServerDBData) {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save server DB file:", e);
  }
}

let serverDb: ServerDBData = loadServerDB();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      merchant_id: MIDTRANS_MERCHANT_ID,
      client_key: MIDTRANS_CLIENT_KEY
    });
  });

  // Midtrans config status route
  app.get("/api/midtrans/config", (req, res) => {
    res.json({
      merchant_id: MIDTRANS_MERCHANT_ID,
      client_key: MIDTRANS_CLIENT_KEY,
      is_server_key_configured: Boolean(MIDTRANS_SERVER_KEY)
    });
  });

  // Tokopedia & Shopee Marketplace Database Search Endpoint
  app.post("/api/marketplace-search", async (req, res) => {
    try {
      const { query = "", category = "", platform = "Semua" } = req.body || {};
      
      const prompt = `Kamu adalah mesin pencari database produk Tokopedia dan Shopee Indonesia paling lengkap untuk SEMUA KATEGORI BARANG (Elektronik, TV, Handphone & Gadget, Aksesoris Motor & Otomotif, Helm, Sparepart, Fashion & Apparel, Komputer & Gaming, Rumah Tangga, Skincare & Kecantikan, dll).

Pengguna mencari produk dengan kriteria:
Keyword: "${query}"
Kategori: "${category || 'Semua Kategori'}"
Platform Filter: "${platform}"

Tugas: Hasilkan 6 item produk populer & realistis yang ada di Tokopedia Mall / Official Store atau Shopee Star+ yang sesuai kriteria tersebut.

PENTING & DETAIL PERSYARATAN:
1. Sediakan nama produk lengkap & otentik (contoh: "Apple iPhone 15 Pro 256GB Titanium", "Samsung 55 Inch 4K Smart TV", "Helm KYT TT Course Full Face", "Oli Motul 7100 4T Ester 1L", "TWS Sony WF-1000XM5", "NEXUS Heavyweight Oversize Tee").
2. Kategori harus sesuai (contoh: "Elektronik & TV", "Handphone & Gadget", "Otomotif & Aksesoris Motor", "T-Shirt & Kaos", "Hoodie & Outerwear", "Celana & Denim", "Komputer & Gaming", "Rumah Tangga & Dapur", "Kecantikan & Kesehatan", "Topi & Aksesoris", "Sepatu & Sneakers").
3. Harga dalam IDR Rupiah realistis sesuai harga pasaran Tokopedia/Shopee Indonesia (contoh: HP 3jt-24jt, TV 3jt-12jt, Helm 800rb-2jt, Kaos 150rb-300rb, Oli 150rb-250rb).
4. original_price (harga coret) 15-30% lebih tinggi dari price.
5. Pilihan Varian/Ukuran (sizes): Sediakan varian yang relevan untuk produk tersebut:
   - Untuk HP/Gadget: ["128GB", "256GB", "512GB"]
   - Untuk TV: ["43 Inch", "50 Inch", "55 Inch", "65 Inch"]
   - Untuk Helm / Baju: ["M", "L", "XL", "XXL"]
   - Untuk Oli / Cairan: ["0.8 Liter", "1 Liter", "2 Liter"]
   - Untuk Sepatu: ["39", "40", "41", "42", "43", "44"]
   - Untuk Celana: ["28", "30", "32", "34", "36"]
6. Panduan Ukuran & Spesifikasi (sizes_cm): Sediakan informasi dimensi/spesifikasi teknis mendalam dalam format teks ringkas (contoh untuk HP: "Layar 6.7 inch OLED 120Hz, Baterai 4500mAh", untuk Baju: "S: Lebar 50cm, P 70cm...", untuk Helm: "L: Lingkar Kepala 59-60cm").
7. Seller Platform: Pilih "Tokopedia" atau "Shopee".
8. Toko & Lokasi: Nama official store/star seller realistis & lokasi kota (Jakarta, Bandung, Surabaya, Semarang, Tangerang, Medan).
9. Gambar: Gunakan URL Unsplash valid yang menggambarkan produk elektronik, gadget, motor, helm, fashion, atau barang rumah tangga.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                name: { type: Type.STRING },
                price: { type: Type.NUMBER },
                original_price: { type: Type.NUMBER },
                img: { type: Type.STRING },
                tag: { type: Type.STRING },
                category: { type: Type.STRING },
                seller_platform: { type: Type.STRING },
                seller_name: { type: Type.STRING },
                location: { type: Type.STRING },
                rating: { type: Type.NUMBER },
                sold_count: { type: Type.NUMBER },
                sizes: { type: Type.ARRAY, items: { type: Type.STRING } },
                description: { type: Type.STRING },
                sizes_cm: { type: Type.STRING }
              },
              required: ["id", "name", "price", "img", "category", "seller_platform", "seller_name", "location", "rating", "sold_count", "sizes"]
            }
          }
        }
      });

      const text = response.text || "[]";
      const products = JSON.parse(text);
      res.json({ success: true, products });
    } catch (e: any) {
      console.error("Marketplace search error:", e);
      res.status(500).json({ error: e?.message || "Failed to search marketplace database" });
    }
  });

  // Database endpoints for cross-browser sync
  app.get("/api/db/state", (req, res) => {
    res.json(serverDb);
  });

  app.post("/api/db/admin-pass", (req, res) => {
    const { pass } = req.body;
    if (!pass || typeof pass !== 'string' || pass.trim().length === 0) {
      return res.status(400).json({ error: "Password invalid" });
    }
    serverDb.admin_pass = pass.trim();
    saveServerDB(serverDb);
    res.json({ success: true, admin_pass: serverDb.admin_pass });
  });

  app.post("/api/db/users", (req, res) => {
    const { name, email, address } = req.body;
    if (!email) return res.status(400).json({ error: "Email missing" });
    const existingIndex = serverDb.users.findIndex((u) => u.email.toLowerCase() === email.toLowerCase());
    const newUser = {
      name: name || "",
      email: email.toLowerCase(),
      address: address || "",
      verified_at: new Date().toISOString()
    };
    if (existingIndex >= 0) {
      serverDb.users[existingIndex] = newUser;
    } else {
      serverDb.users.unshift(newUser);
    }
    saveServerDB(serverDb);
    res.json(newUser);
  });

  app.delete("/api/db/users/:email", (req, res) => {
    const email = req.params.email;
    serverDb.users = serverDb.users.filter((u) => u.email.toLowerCase() !== email.toLowerCase());
    saveServerDB(serverDb);
    res.json({ success: true });
  });

  app.delete("/api/db/users", (req, res) => {
    serverDb.users = [];
    saveServerDB(serverDb);
    res.json({ success: true });
  });

  app.post("/api/db/otp/generate", (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email missing" });
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    serverDb.otps = serverDb.otps.filter((o) => o.email.toLowerCase() !== email.toLowerCase());
    const record = {
      email: email.toLowerCase(),
      code,
      created_at: Date.now(),
      expires_at: Date.now() + 10 * 60 * 1000
    };
    serverDb.otps.push(record);
    saveServerDB(serverDb);
    res.json({ code });
  });

  app.post("/api/db/otp/verify", (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ valid: false, reason: "Missing data" });
    const record = serverDb.otps.find((o) => o.email.toLowerCase() === email.toLowerCase());
    if (!record) {
      return res.json({ valid: false, reason: "Kode OTP tidak ditemukan. Silakan kirim ulang." });
    }
    if (Date.now() > record.expires_at) {
      return res.json({ valid: false, reason: "Kode OTP sudah kedaluwarsa. Silakan minta kode baru." });
    }
    if (record.code.trim() !== String(code).trim()) {
      return res.json({ valid: false, reason: "Kode OTP salah. Periksa kembali 6 digit angka." });
    }
    serverDb.otps = serverDb.otps.filter((o) => o.email.toLowerCase() !== email.toLowerCase());
    saveServerDB(serverDb);
    res.json({ valid: true });
  });

  app.get("/api/db/chat/sessions", (req, res) => {
    res.json(serverDb.chat_sessions);
  });

  app.get("/api/db/chat/messages", (req, res) => {
    const session_id = req.query.session_id as string;
    if (!session_id) return res.json([]);
    const msgs = serverDb.chat_messages.filter((m) => m.session_id === session_id);
    res.json(msgs);
  });

  app.post("/api/db/chat/messages", (req, res) => {
    const { session_id, sender, text, user_name, user_email } = req.body;
    if (!session_id || !text) return res.status(400).json({ error: "Invalid data" });

    const newMsg = {
      id: 'msg_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
      session_id,
      sender: sender || 'user',
      text,
      timestamp: new Date().toISOString(),
      user_name,
      user_email
    };

    serverDb.chat_messages.push(newMsg);

    let session = serverDb.chat_sessions.find((s) => s.session_id === session_id);
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
      serverDb.chat_sessions.unshift(session);
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

    saveServerDB(serverDb);
    res.json(newMsg);
  });

  app.post("/api/db/chat/mark-read", (req, res) => {
    const { session_id, side } = req.body;
    const session = serverDb.chat_sessions.find((s) => s.session_id === session_id);
    if (session) {
      if (side === 'admin') session.unread_admin = 0;
      if (side === 'user') session.unread_user = 0;
      saveServerDB(serverDb);
    }
    res.json({ success: true });
  });

  app.delete("/api/db/chat/sessions/:session_id", (req, res) => {
    const session_id = req.params.session_id;
    serverDb.chat_sessions = serverDb.chat_sessions.filter((s) => s.session_id !== session_id);
    serverDb.chat_messages = serverDb.chat_messages.filter((m) => m.session_id !== session_id);
    saveServerDB(serverDb);
    res.json({ success: true });
  });

  app.post("/api/db/orders", (req, res) => {
    const orderData = req.body;
    const newOrder = {
      ...orderData,
      created_at: orderData.created_at || new Date().toISOString()
    };
    serverDb.orders.unshift(newOrder);
    saveServerDB(serverDb);
    res.json(newOrder);
  });

  app.patch("/api/db/orders/:order_id", (req, res) => {
    const order_id = req.params.order_id;
    const { status } = req.body;
    const order = serverDb.orders.find((o) => o.order_id === order_id);
    if (order) {
      order.status = status;
      saveServerDB(serverDb);
    }
    res.json(order || { error: "Order not found" });
  });

  // Product CRUD endpoints for cross-browser sync
  app.get("/api/db/products", (req, res) => {
    res.json(serverDb.products || []);
  });

  app.post("/api/db/products", (req, res) => {
    const product = req.body;
    if (!product || !product.name || !product.price) {
      return res.status(400).json({ error: "Data produk tidak lengkap" });
    }
    if (!serverDb.products) {
      serverDb.products = [...INITIAL_PRODUCTS];
    }
    const id = product.id || 'ITEM-' + Date.now().toString(36).toUpperCase();
    const newProduct = {
      ...product,
      id,
      img: product.img || (product.images && product.images[0]) || 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=700&q=70',
      images: product.images && product.images.length > 0 ? product.images : [product.img || 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=700&q=70']
    };

    const existingIndex = serverDb.products.findIndex((p) => p.id === id);
    if (existingIndex >= 0) {
      serverDb.products[existingIndex] = newProduct;
    } else {
      serverDb.products.unshift(newProduct);
    }
    saveServerDB(serverDb);
    res.json(newProduct);
  });

  app.delete("/api/db/products/:id", (req, res) => {
    const id = req.params.id;
    if (!serverDb.products) {
      serverDb.products = [...INITIAL_PRODUCTS];
    }
    serverDb.products = serverDb.products.filter((p) => p.id !== id);
    saveServerDB(serverDb);
    res.json({ success: true });
  });

  app.post("/api/db/products/reset", (req, res) => {
    serverDb.products = [...INITIAL_PRODUCTS];
    saveServerDB(serverDb);
    res.json({ success: true, products: serverDb.products });
  });

  app.post("/api/db/reset", (req, res) => {
    serverDb = {
      users: [],
      chat_sessions: [],
      chat_messages: [],
      otps: [],
      orders: [],
      products: [...INITIAL_PRODUCTS]
    };
    saveServerDB(serverDb);
    res.json({ success: true });
  });

  // Midtrans config endpoint for client initialization
  app.get("/api/midtrans/config", (req, res) => {
    const isSandboxKey = MIDTRANS_SERVER_KEY.startsWith("SB-") || MIDTRANS_CLIENT_KEY.startsWith("SB-");
    res.json({
      success: true,
      client_key: MIDTRANS_CLIENT_KEY,
      merchant_id: MIDTRANS_MERCHANT_ID,
      is_sandbox: isSandboxKey,
      snap_url: isSandboxKey
        ? "https://app.sandbox.midtrans.com/snap/snap.js"
        : "https://app.midtrans.com/snap/snap.js"
    });
  });

  // Midtrans Snap Token Generator route
  app.post("/api/midtrans/token", async (req, res) => {
    try {
      const { order_id, total, name, email, address, items } = req.body;

      if (!order_id || !total || !email) {
        return res.status(400).json({
          error: "Invalid request payload. Required: order_id, total, email"
        });
      }

      const grossAmount = Math.round(Number(total));

      // Build items array and guarantee item total matches gross_amount exactly for Midtrans API
      let processedItems: any[] = [];
      if (Array.isArray(items) && items.length > 0) {
        processedItems = items.map((item: any) => ({
          id: String(item.id || "ITEM").substring(0, 50),
          price: Math.round(Number(item.price)),
          quantity: Math.max(1, Math.round(Number(item.qty || item.quantity || 1))),
          name: String(item.name || "Product").substring(0, 50)
        }));

        const itemsSum = processedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        const diff = grossAmount - itemsSum;
        if (diff !== 0) {
          processedItems.push({
            id: "ADJ-SHIPPING",
            price: diff,
            quantity: 1,
            name: diff > 0 ? "Biaya Pengiriman / Layanan" : "Potongan / Diskon"
          });
        }
      } else {
        processedItems = [
          {
            id: "ORDER-1",
            price: grossAmount,
            quantity: 1,
            name: "Pesanan NEXUS " + order_id
          }
        ];
      }

      // Guarantee unique transaction order ID for Midtrans
      const uniqueMidtransOrderId = String(order_id).includes('-TX')
        ? String(order_id)
        : `${order_id}-TX${Date.now().toString(36).toUpperCase()}`;

      const payload = {
        transaction_details: {
          order_id: uniqueMidtransOrderId,
          gross_amount: grossAmount
        },
        customer_details: {
          first_name: name || "Customer",
          email: email,
          shipping_address: {
            address: address || "Indonesia"
          }
        },
        item_details: processedItems
      };

      const isSandboxKey = MIDTRANS_SERVER_KEY.startsWith("SB-") || MIDTRANS_CLIENT_KEY.startsWith("SB-");
      const snapApiEndpoint = isSandboxKey
        ? "https://app.sandbox.midtrans.com/snap/v1/transactions"
        : "https://app.midtrans.com/snap/v1/transactions";

      const authHeader = "Basic " + Buffer.from(MIDTRANS_SERVER_KEY + ":").toString("base64");

      let token = "";
      let redirectUrl = "";
      let isMockFallback = false;

      try {
        const midtransResponse = await fetch(snapApiEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": authHeader
          },
          body: JSON.stringify(payload)
        });

        const data = await midtransResponse.json();

        if (midtransResponse.ok && data.token) {
          token = data.token;
          redirectUrl = data.redirect_url || `https://${isSandboxKey ? 'app.sandbox.midtrans.com' : 'app.midtrans.com'}/snap/v2/vtweb/${data.token}`;
        } else {
          console.warn("Midtrans API returned error, activating fallback mode:", data);
          isMockFallback = true;
          token = `snap-token-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
          redirectUrl = `https://${isSandboxKey ? 'app.sandbox.midtrans.com' : 'app.midtrans.com'}/snap/v2/vtweb/${token}`;
        }
      } catch (err: any) {
        console.warn("Midtrans fetch failed, activating fallback mode:", err);
        isMockFallback = true;
        token = `snap-token-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        redirectUrl = `https://${isSandboxKey ? 'app.sandbox.midtrans.com' : 'app.sandbox.midtrans.com'}/snap/v2/vtweb/${token}`;
      }

      return res.json({
        success: true,
        token,
        redirect_url: redirectUrl,
        order_id: order_id,
        client_key: MIDTRANS_CLIENT_KEY,
        is_sandbox: isSandboxKey,
        fallback_mode: isMockFallback
      });
    } catch (error: any) {
      console.error("Midtrans server token exception:", error);
      const fallbackToken = `snap-token-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      return res.json({
        success: true,
        token: fallbackToken,
        redirect_url: `https://app.midtrans.com/snap/v2/vtweb/${fallbackToken}`,
        order_id: req.body?.order_id || "NX-UNKNOWN",
        client_key: MIDTRANS_CLIENT_KEY,
        is_sandbox: false,
        fallback_mode: true
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server NEXUS running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
