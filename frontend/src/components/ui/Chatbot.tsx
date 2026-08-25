import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, User, Loader2, ChevronDown, FileText, Settings, Key } from "lucide-react";
import { knowledgeBase } from "../../data/knowledgeBase";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

function getApiKey(): string {
  return import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem("VITE_GEMINI_API_KEY") || "";
}

function buildSystemContext(): string {
  const parts = Object.values(knowledgeBase)
    .filter((d) => d.text.length > 0)
    .map((d) => `=== ${d.label} ===\n${d.text}`);
  return parts.join("\n\n");
}

const SYSTEM_PROMPT = `You are Volus HR Assistant, a helpful AI assistant for Novelus employees. 
You answer questions ONLY based on the following official HR documents. 
If the answer is not in the documents, say so politely and suggest contacting HR.
Answer in the same language the user writes in (French or English).
Be concise, friendly, and professional.

DOCUMENTS:
${buildSystemContext()}`;

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(getApiKey());
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize messages inside useEffect to prevent SSR/hydration mismatch with timestamps
  useEffect(() => {
    setMessages([
      {
        id: 0,
        role: "assistant",
        content: "Hello! I am **Volus HR Assistant** 👋\n\nI can answer your questions about:\n- 📋 Leave Policy\n- 📖 Employee Handbook\n- 👥 Referral Policy\n- 🏥 Mashrek Medical Insurance\n\nHow can I help you?",
        timestamp: new Date(),
      },
    ]);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const currentKey = getApiKey();
    if (!currentKey) {
      setMessages((prev) => [
        ...prev,
        { id: Date.now(), role: "user", content: text, timestamp: new Date() },
        { 
          id: Date.now() + 1, 
          role: "assistant", 
          content: "⚠️ **Missing API Key.** Please configure your Gemini API key by clicking the gear icon ⚙️ at the top right.", 
          timestamp: new Date() 
        }
      ]);
      setInput("");
      return;
    }

    const userMsg: Message = { id: Date.now(), role: "user", content: text, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = messages.slice(1).map((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      }));

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${currentKey}`;

      const response = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [
            ...history,
            { role: "user", parts: [{ text }] },
          ],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err?.error?.message || "API error");
      }

      const data = await response.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Je n'ai pas pu générer une réponse.";

      const botMsg: Message = { id: Date.now() + 1, role: "assistant", content: reply, timestamp: new Date() };
      setMessages((prev) => [...prev, botMsg]);
      if (!isOpen) setUnread((n) => n + 1);
    } catch (err: any) {
      const errMsg: Message = {
        id: Date.now() + 1,
        role: "assistant",
        content: `⚠️ Error: ${err.message}\n\nPlease check your Gemini API key or try to re-enter it by clicking the ⚙️ button.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }

  function saveApiKey() {
    const val = apiKeyInput.trim();
    if (val) {
      localStorage.setItem("VITE_GEMINI_API_KEY", val);
    } else {
      localStorage.removeItem("VITE_GEMINI_API_KEY");
    }
    setShowSettings(false);
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        role: "assistant",
        content: "✅ API Key configured successfully! You can now ask me your questions.",
        timestamp: new Date()
      }
    ]);
  }

  function renderContent(text: string) {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/\n/g, "<br/>");
  }

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-200"
        title="Volus HR Assistant"
      >
        {isOpen ? <ChevronDown size={22} /> : <MessageCircle size={22} />}
        {!isOpen && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-6 z-50 w-[370px] h-[550px] flex flex-col rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
          style={{ background: "#f8fafc" }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Bot size={18} className="text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-tight">Volus HR Assistant</p>
                <p className="text-blue-100 text-[10px]">Powered by Gemini AI</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`w-7 h-7 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all ${showSettings ? 'rotate-45 text-white' : ''}`}
                title="Configuration clé API"
              >
                <Settings size={15} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Settings Overlay */}
          {showSettings ? (
            <div className="flex-1 p-5 flex flex-col justify-center bg-white">
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Key size={20} />
                </div>
                <h3 className="font-bold text-slate-800 text-sm">Gemini API Key</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Required to query the model. It is stored locally in your browser.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">API Key</label>
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="Enter your API key (AIzaSy... or AQ...)"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowSettings(false)}
                    className="flex-1 py-2 text-xs font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveApiKey}
                    className="flex-1 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Document chips */}
              <div className="flex gap-1.5 px-3 py-2 bg-white border-b border-slate-100 overflow-x-auto flex-shrink-0">
                {Object.values(knowledgeBase).map((doc) => (
                  <span
                    key={doc.label}
                    className="flex-shrink-0 flex items-center gap-1 text-[10px] bg-blue-50 text-blue-600 border border-blue-100 rounded-full px-2 py-0.5 font-medium"
                  >
                    <FileText size={10} />
                    {doc.label.split(" ").slice(0, 3).join(" ")}
                  </span>
                ))}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold ${
                        msg.role === "user" ? "bg-indigo-500" : "bg-gradient-to-br from-blue-500 to-blue-700"
                      }`}
                    >
                      {msg.role === "user" ? <User size={13} /> : <Bot size={13} />}
                    </div>

                    {/* Bubble */}
                    <div
                      className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-relaxed shadow-sm ${
                        msg.role === "user"
                          ? "bg-indigo-600 text-white rounded-tr-sm"
                          : "bg-white text-slate-700 border border-slate-100 rounded-tl-sm"
                      }`}
                      dangerouslySetInnerHTML={{ __html: renderContent(msg.content) }}
                    />
                  </div>
                ))}

                {/* Loading indicator */}
                {loading && (
                  <div className="flex gap-2 flex-row">
                    <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700 text-white">
                      <Bot size={13} />
                    </div>
                    <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-3 py-3 bg-white border-t border-slate-100 flex-shrink-0">
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                    placeholder="Ask your HR question..."
                    className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none"
                    disabled={loading}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || loading}
                    className="w-7 h-7 bg-blue-600 text-white rounded-lg flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                  >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={13} />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 text-center mt-1.5">
                  Based on official Novelus documents
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
