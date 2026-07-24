export interface Product {
  id: string;
  name: string;
  price: number;
  original_price?: number;
  img: string;
  images?: string[];
  tag: string;
  category?: string;
  seller_platform?: 'Tokopedia' | 'Shopee' | 'NEXUS Mall' | 'Official Store';
  seller_name?: string;
  location?: string;
  rating?: number;
  sold_count?: number;
  sizes?: string[];
  colors?: string[];
  description?: string;
  sizes_cm?: string;
  shipping_methods?: string[];
  stock?: number;
}

export interface CartItem {
  id: string;
  qty: number;
  size?: string;
}

export interface User {
  email: string;
  name: string;
  address: string;
  verified_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  sender: 'user' | 'admin';
  text: string;
  timestamp: string;
  user_name?: string;
  user_email?: string;
}

export interface ChatSession {
  session_id: string;
  user_name: string;
  user_email: string;
  last_message: string;
  last_updated: string;
  unread_admin: number;
  unread_user: number;
}

export interface OtpRecord {
  email: string;
  code: string;
  created_at: number;
  expires_at: number;
}

export interface Order {
  order_id: string;
  email: string;
  name: string;
  phone?: string;
  country_code?: string;
  address: string;
  items: {
    id: string;
    name: string;
    qty: number;
    price: number;
    size?: string;
  }[];
  subtotal?: number;
  ppn?: number;
  shipping_method?: string;
  shipping_fee?: number;
  total: number;
  status: 'pending' | 'paid' | 'cancelled';
  created_at: string;
}

export interface ToastNotification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error';
}
