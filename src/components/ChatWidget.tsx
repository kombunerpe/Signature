import React, { useState, useEffect, useRef } from 'react';
import { DB, subscribeDB } from '../lib/database';
import { ChatMessage } from '../types';
import { MessageSquare, X, Send, User, CheckCheck } from 'lucide-react';

interface ChatWidgetProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export const ChatWidget: React.FC<ChatWidgetProps> = ({ isOpen, onToggle, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [userName, setUserName] = useState<string>('Tamu');
  const [userEmail, setUserEmail] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sid = DB.session.getOrCreateChatSessionId();

  const syncChat = () => {
    const cur = DB.session.getCurrentUser();
    if (cur?.name) setUserName(cur.name);
    if (cur?.email) setUserEmail(cur.email);

    const msgs = DB.chat.getMessages(sid);
    setMessages(msgs);
  };

  useEffect(() => {
    syncChat();
    const unsubscribe = subscribeDB(syncChat);
    const interval = setInterval(syncChat, 1500);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [sid]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      // Mark messages read by user
      DB.chat.markRead(sid, 'user');
    }
  }, [isOpen, messages.length]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text) return;

    DB.chat.sendMessage({
      session_id: sid,
      sender: 'user',
      text,
      user_name: userName,
      user_email: userEmail
    });

    setInputText('');
    syncChat();

    // Simulated CS Auto-reply after 2 seconds if first message or idle
    setTimeout(() => {
      const currentMsgs = DB.chat.getMessages(sid);
      const lastMsg = currentMsgs[currentMsgs.length - 1];
      if (lastMsg && lastMsg.sender === 'user') {
        const autoReplies = [
          'Halo! Tim Customer Support NEXUS siap membantu. Ada yang bisa kami bantu mengenai ukuran atau stok drop terbaru?',
          'Terima kasih pesannya! Silakan sebutkan kode produk atau pertanyaan kamu.',
          'Sip! CS kami akan membalas pesan kamu sebentar lagi ya.'
        ];
        const randomReply = autoReplies[Math.floor(Math.random() * autoReplies.length)];
        DB.chat.sendMessage({
          session_id: sid,
          sender: 'admin',
          text: randomReply,
          user_name: 'CS NEXUS'
        });
        syncChat();
      }
    }, 2000);
  };

  const handleChangeName = () => {
    const newName = prompt('Masukkan nama Anda untuk CS:', userName);
    if (newName && newName.trim()) {
      setUserName(newName.trim());
      DB.session.setCurrentUser({ name: newName.trim() });
    }
  };

  // Count unread admin messages for floating button badge
  const currentSessions = DB.chat.getSessions();
  const mySession = currentSessions.find((s) => s.session_id === sid);
  const unreadUserCount = mySession?.unread_user || 0;

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        id="chatToggle"
        data-testid="chat-toggle"
        onClick={onToggle}
        className="fixed bottom-5 right-5 z-40 bg-[#0a0a0a] hover:bg-[#222222] text-[#f4f2ee] w-14 h-14 rounded-full shadow-2xl flex items-center justify-center border-2 border-[#e9ff00] transition-all hover:scale-105"
      >
        <MessageSquare className="w-6 h-6 text-[#e9ff00]" />
        {unreadUserCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-[#ff5a1f] text-white font-mono-code font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#0a0a0a]">
            {unreadUserCount}
          </span>
        )}
      </button>

      {/* Chat Popup Panel */}
      {isOpen && (
        <aside
          id="chatPanel"
          data-testid="chat-panel"
          className="fixed bottom-22 right-5 z-40 w-[92vw] sm:w-96 h-[520px] bg-[#f4f2ee] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-[#0a0a0a]/20 animate-in fade-in slide-in-from-bottom-5 duration-200"
        >
          {/* Header */}
          <div className="bg-[#0a0a0a] text-[#f4f2ee] px-4 py-3.5 flex items-center justify-between border-b border-[#e9ff00]/20">
            <div>
              <div className="font-display text-xl tracking-wider text-[#f4f2ee]">
                NEXUS · LIVE CS
              </div>
              <div className="font-mono-code text-[10px] tracking-widest text-[#e9ff00] font-semibold">
                ● Online · Respon 1-2 Menit
              </div>
            </div>
            <button
              id="chatClose"
              data-testid="chat-close"
              onClick={onClose}
              className="text-[#f4f2ee] hover:text-[#e9ff00] p-1 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Name Tag Bar */}
          <div className="px-3.5 py-2 bg-white border-b border-[#0a0a0a]/10 font-mono-code text-[11px] text-[#0a0a0a]/70 flex justify-between items-center">
            <span className="flex items-center gap-1.5 truncate">
              <User className="w-3.5 h-3.5 text-[#ff5a1f]" />
              <span>Nama: <b id="chatUserName" data-testid="chat-user-name" className="text-[#0a0a0a]">{userName}</b></span>
            </span>
            <button
              id="chatSetName"
              data-testid="chat-set-name"
              onClick={handleChangeName}
              className="text-[#0a0a0a] hover:text-[#ff5a1f] underline font-semibold text-[10px] uppercase"
            >
              Ubah
            </button>
          </div>

          {/* Chat Messages */}
          <div
            id="chatMessages"
            data-testid="chat-messages"
            className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f4f2ee]"
          >
            {messages.length === 0 ? (
              <div
                data-testid="chat-empty"
                className="text-center text-[#0a0a0a]/50 font-mono-code text-[11px] uppercase tracking-wider py-12 px-4 space-y-2"
              >
                <MessageSquare className="w-8 h-8 mx-auto text-[#0a0a0a]/20" />
                <p>Sapa Customer Service NEXUS — biasanya dibalas dalam 1-2 menit.</p>
              </div>
            ) : (
              messages.map((m) => {
                const isUser = m.sender === 'user';
                return (
                  <div
                    key={m.id}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      data-testid={`chat-msg-${m.sender}`}
                      className={`max-w-[82%] px-3.5 py-2.5 text-sm font-sans-body shadow-sm ${
                        isUser
                          ? 'bg-[#0a0a0a] text-[#f4f2ee] rounded-t-xl rounded-bl-xl rounded-br-xs'
                          : 'bg-white text-[#0a0a0a] border border-[#0a0a0a]/15 rounded-t-xl rounded-br-xl rounded-bl-xs'
                      }`}
                    >
                      <div className="whitespace-pre-wrap break-words">{m.text}</div>
                      <div
                        className={`font-mono-code text-[9px] mt-1 flex items-center gap-1 ${
                          isUser ? 'text-[#f4f2ee]/60 justify-end' : 'text-[#0a0a0a]/50'
                        }`}
                      >
                        <span>
                          {new Date(m.timestamp).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        {isUser && <CheckCheck className="w-3 h-3 text-[#e9ff00]" />}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Form */}
          <form
            id="chatForm"
            onSubmit={handleSend}
            className="border-t border-[#0a0a0a]/10 p-2.5 flex gap-2 bg-white"
          >
            <input
              id="chatInput"
              data-testid="chat-input"
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Tulis pesan ke CS..."
              className="flex-1 border border-[#0a0a0a]/20 rounded px-3 py-2 text-sm font-sans-body focus:outline-none focus:border-[#0a0a0a]"
            />
            <button
              type="submit"
              data-testid="chat-send"
              className="bg-[#0a0a0a] hover:bg-[#222222] text-[#e9ff00] px-3.5 py-2 font-mono-code uppercase text-xs tracking-widest font-bold rounded flex items-center justify-center transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </aside>
      )}
    </>
  );
};
