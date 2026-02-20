import { useState, useRef, useCallback, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import {
  Plus,
  Clock,
  Settings,
  PlusCircle,
  Image,
  ArrowRight,
  RefreshCw,
  User,
  Mail,
  FileText,
  SlidersHorizontal,
  Triangle,
  Loader2,
  AlertCircle,
  X,
  Trash2,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Prompt {
  id: number;
  text: string;
  Icon: React.ElementType;
}

type BotMsg = {
  id: number;
  type: "bot";
  status: "loading" | "done" | "error";
  kind?: "animation" | "text";
  videoUrl?: string;
  sceneName?: string;
  text?: string;
  error?: string;
};

type Message = { id: number; type: "user"; text: string } | BotMsg;

interface Session {
  id: number;
  title: string;
  messages: Message[];
  timestamp: number;
}

// ── Data ──────────────────────────────────────────────────────────────────────

const ALL_PROMPTS: Prompt[] = [
  { id: 1, text: "Animate the sine and cosine waves", Icon: SlidersHorizontal },
  { id: 2, text: "Show the Pythagorean theorem visually", Icon: FileText },
  { id: 3, text: "Visualize how a neural network works", Icon: Mail },
  { id: 4, text: "Animate bubble sort algorithm step by step", Icon: User },
];

const STORAGE_KEY = "manim-sessions";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function loadSessions(): Session[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveSessions(sessions: Session[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Normalize LaTeX delimiters so remark-math can parse them all
function preprocessMath(text: string): string {
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_: string, m: string) => `$$${m}$$`);
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_: string, m: string) => `$${m}$`);
  text = text.replace(/^\[ (\\[\s\S]*?) \]$/gm, (_: string, m: string) => `$$${m}$$`);
  return text;
}

function buildHistory(messages: Message[]): { role: "user" | "assistant"; content: string }[] {
  return messages.flatMap((m) => {
    if (m.type === "user") return [{ role: "user" as const, content: m.text }];
    if (m.type === "bot" && m.status === "done") {
      const content =
        m.kind === "animation" ? `[Generated Manim animation: ${m.sceneName}]` : (m.text ?? "");
      return [{ role: "assistant" as const, content }];
    }
    return [];
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PromptCard({ prompt, onClick }: { prompt: Prompt; onClick: (text: string) => void }) {
  return (
    <button
      onClick={() => onClick(prompt.text)}
      className="flex flex-col justify-between gap-6 p-4 rounded-xl text-left bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 hover:border-neutral-700 hover:-translate-y-0.5 hover:brightness-110 transition-all duration-150 cursor-pointer w-full min-h-[110px]"
    >
      <p className="text-sm text-neutral-300 leading-snug">{prompt.text}</p>
      <prompt.Icon size={16} strokeWidth={1.5} className="text-neutral-600" />
    </button>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[70%] bg-neutral-800 text-neutral-200 text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm leading-relaxed">
        {text}
      </div>
    </div>
  );
}

function BotAvatar() {
  return (
    <div className="w-7 h-7 rounded-full bg-neutral-800 flex items-center justify-center flex-shrink-0 mt-0.5">
      <Triangle size={12} className="text-white fill-white" />
    </div>
  );
}

function BotBubble({ msg }: { msg: BotMsg }) {
  if (msg.status === "loading") {
    return (
      <div className="flex items-start gap-3">
        <BotAvatar />
        <div className="flex items-center gap-2 text-sm text-neutral-500 py-2">
          <Loader2 size={14} className="animate-spin" />
          Thinking…
        </div>
      </div>
    );
  }

  if (msg.status === "error") {
    return (
      <div className="flex items-start gap-3">
        <BotAvatar />
        <div className="flex items-center gap-2 text-sm text-red-400 py-2">
          <AlertCircle size={14} />
          {msg.error ?? "Something went wrong."}
        </div>
      </div>
    );
  }

  if (msg.kind === "text") {
    return (
      <div className="flex items-start gap-3">
        <BotAvatar />
        <div className="text-sm text-neutral-300 leading-relaxed max-w-2xl py-1
          [&_p]:mb-3 [&_p:last-child]:mb-0
          [&_strong]:text-neutral-100 [&_strong]:font-semibold
          [&_em]:text-neutral-300
          [&_h1]:text-neutral-100 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:mb-2
          [&_h2]:text-neutral-100 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mb-2
          [&_h3]:text-neutral-200 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-1
          [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ul>li]:mb-1
          [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_ol>li]:mb-1
          [&_code]:bg-neutral-800 [&_code]:text-emerald-400 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono
          [&_pre]:bg-neutral-800 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:mb-3 [&_pre]:overflow-x-auto
          [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-emerald-400 [&_pre_code]:text-xs
          [&_blockquote]:border-l-2 [&_blockquote]:border-neutral-600 [&_blockquote]:pl-3 [&_blockquote]:text-neutral-400 [&_blockquote]:italic
          [&_a]:text-blue-400 [&_a]:underline [&_hr]:border-neutral-700"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
            {preprocessMath(msg.text ?? "")}
          </ReactMarkdown>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <BotAvatar />
      <div className="flex flex-col gap-2 flex-1">
        <p className="text-xs text-neutral-500">{msg.sceneName}</p>
        <video
          src={`http://localhost:8000${msg.videoUrl}`}
          controls
          autoPlay
          loop
          className="rounded-xl w-full max-w-2xl border border-neutral-800 bg-black"
        />
      </div>
    </div>
  );
}

function Composer({
  textareaRef, input, loading, MAX, onChange, onKeyDown, onSend, placeholder, showAttachments,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  input: string; loading: boolean; MAX: number;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void; placeholder: string; showAttachments?: boolean;
}) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col gap-3">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={2}
        className="flex-1 resize-none bg-transparent border-0 outline-none text-sm text-neutral-200 placeholder-neutral-600 leading-relaxed min-h-[48px] max-h-40 font-[inherit] w-full"
      />
      <div className="flex items-center gap-4">
        {showAttachments && (
          <>
            <button className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors bg-transparent border-0 p-0 cursor-pointer">
              <PlusCircle size={14} strokeWidth={1.75} /> Add Attachment
            </button>
            <button className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors bg-transparent border-0 p-0 cursor-pointer">
              <Image size={14} strokeWidth={1.75} /> Use Image
            </button>
          </>
        )}
        <div className="flex-1" />
        <span className="text-xs text-neutral-600 tabular-nums">{input.length}/{MAX}</span>
        <button
          onClick={onSend}
          disabled={loading || !input.trim()}
          aria-label="Send"
          className="w-8 h-8 rounded-lg bg-white flex items-center justify-center hover:bg-neutral-200 active:scale-95 transition-all duration-100 cursor-pointer border-0 flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading
            ? <Loader2 size={13} className="text-black animate-spin" />
            : <ArrowRight size={14} className="text-black" strokeWidth={2.5} />}
        </button>
      </div>
    </div>
  );
}

// ── History Panel ─────────────────────────────────────────────────────────────

function HistoryPanel({
  sessions,
  onSelect,
  onDelete,
  onClose,
}: {
  sessions: Session[];
  onSelect: (s: Session) => void;
  onDelete: (id: number, e: React.MouseEvent) => void;
  onClose: () => void;
}) {
  return (
    <div className="w-64 flex-shrink-0 bg-[#111111] border-r border-neutral-900 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-900">
        <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">History</span>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors bg-transparent border-0 cursor-pointer p-0"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {sessions.length === 0 ? (
          <p className="text-xs text-neutral-600 text-center mt-8 px-4">No previous chats yet.</p>
        ) : (
          sessions.slice().reverse().map((s) => (
            <div
              key={s.id}
              onClick={() => onSelect(s)}
              className="group flex items-start justify-between gap-2 px-3 py-2.5 mx-2 rounded-lg hover:bg-neutral-800 cursor-pointer transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-neutral-300 truncate leading-snug">{s.title}</p>
                <p className="text-xs text-neutral-600 mt-0.5">{relativeTime(s.timestamp)}</p>
              </div>
              <button
                onClick={(e) => onDelete(s.id, e)}
                className="opacity-0 group-hover:opacity-100 flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-neutral-500 hover:text-red-400 transition-all bg-transparent border-0 cursor-pointer p-0 mt-0.5"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

let nextId = 1;
let nextSessionId = 1;

export default function App() {
  const [prompts, setPrompts] = useState<Prompt[]>(ALL_PROMPTS);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<Session[]>(loadSessions);
  const [showHistory, setShowHistory] = useState(false);
  const MAX = 1000;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Persist sessions to localStorage
  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Save current chat as a session (if non-empty) and reset
  const saveAndReset = useCallback((currentMessages: Message[]) => {
    const completed = currentMessages.filter(
      (m) => m.type === "user" || (m.type === "bot" && m.status === "done")
    );
    if (completed.length === 0) return;

    const firstUser = completed.find((m) => m.type === "user") as { text: string } | undefined;
    const title = firstUser ? firstUser.text.slice(0, 60) : "Untitled chat";

    setSessions((prev) => [
      ...prev,
      { id: nextSessionId++, title, messages: completed, timestamp: Date.now() },
    ]);
  }, []);

  const handleNewChat = useCallback(() => {
    if (messages.length > 0) saveAndReset(messages);
    setMessages([]);
    setInput("");
    setShowHistory(false);
  }, [messages, saveAndReset]);

  const handleSelectSession = useCallback((session: Session) => {
    if (messages.length > 0) saveAndReset(messages);
    setMessages(session.messages);
    setShowHistory(false);
  }, [messages, saveAndReset]);

  const handleDeleteSession = useCallback((id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleCardClick = useCallback((text: string) => {
    setInput(text.slice(0, MAX));
    textareaRef.current?.focus();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (e.target.value.length <= MAX) setInput(e.target.value);
  };

  const handleSend = async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput("");
    setLoading(true);

    const userId = nextId++;
    const botId = nextId++;

    const historySnapshot = buildHistory(messages);
    historySnapshot.push({ role: "user", content: msg });

    setMessages((prev) => [
      ...prev,
      { id: userId, type: "user", text: msg },
      { id: botId, type: "bot", status: "loading" },
    ]);

    try {
      const res = await fetch("http://localhost:8000/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: historySnapshot }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? "Server error");
      }

      const data = await res.json();

      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== botId) return m;
          if (data.type === "text") {
            return { id: botId, type: "bot", status: "done", kind: "text", text: data.content } as BotMsg;
          }
          return { id: botId, type: "bot", status: "done", kind: "animation", videoUrl: data.video_url, sceneName: data.scene_name } as BotMsg;
        })
      );
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : "Unknown error";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botId ? ({ id: botId, type: "bot", status: "error", error: errMsg } as BotMsg) : m
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const inChat = messages.length > 0;

  return (
    <div className="flex h-screen overflow-hidden bg-[#0d0d0d]">
      {/* ── Sidebar ── */}
      <aside className="w-16 flex-shrink-0 bg-[#111111] border-r border-neutral-900 flex flex-col items-center py-4 gap-1 z-10">
        <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center mb-2">
          <Triangle size={16} className="text-black fill-black" />
        </div>

        {/* New Chat */}
        <button
          onClick={handleNewChat}
          aria-label="New chat"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors duration-150 cursor-pointer border-0 bg-transparent p-0"
        >
          <Plus size={18} strokeWidth={1.75} />
        </button>

        <div className="w-full h-px bg-neutral-800 my-1" />

        {/* History */}
        <button
          onClick={() => setShowHistory((v) => !v)}
          aria-label="History"
          className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors duration-150 cursor-pointer border-0 p-0 ${
            showHistory
              ? "bg-neutral-700 text-neutral-200"
              : "text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 bg-transparent"
          }`}
        >
          <Clock size={18} strokeWidth={1.75} />
        </button>

        <div className="flex-1" />

        <button
          aria-label="Settings"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors duration-150 cursor-pointer border-0 bg-transparent p-0"
        >
          <Settings size={18} strokeWidth={1.75} />
        </button>
        <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center mt-1 cursor-pointer">
          <User size={16} strokeWidth={1.5} className="text-neutral-400" />
        </div>
      </aside>

      {/* ── History Panel ── */}
      {showHistory && (
        <HistoryPanel
          sessions={sessions}
          onSelect={handleSelectSession}
          onDelete={handleDeleteSession}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {inChat ? (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="max-w-3xl mx-auto flex flex-col gap-5">
                {messages.map((m) =>
                  m.type === "user"
                    ? <UserBubble key={m.id} text={m.text} />
                    : <BotBubble key={m.id} msg={m} />
                )}
                <div ref={bottomRef} />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-neutral-900">
              <div className="max-w-3xl mx-auto">
                <Composer
                  textareaRef={textareaRef}
                  input={input}
                  loading={loading}
                  MAX={MAX}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  onSend={handleSend}
                  placeholder="Ask a follow-up or request another animation…"
                  showAttachments
                />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-6 py-10">
            <div className="w-full max-w-3xl flex flex-col gap-7">
              <div>
                <h1 className="text-4xl font-normal leading-tight tracking-tight text-neutral-500">
                  Hi there, what would you like to know?
                </h1>
                <p className="mt-4 text-sm text-neutral-500 leading-relaxed">
                  Describe a math or CS concept and I'll generate an animation for you.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {prompts.map((p) => (
                  <PromptCard key={p.id} prompt={p} onClick={handleCardClick} />
                ))}
              </div>

              <button
                onClick={() => setPrompts(shuffle(ALL_PROMPTS))}
                className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-300 transition-colors bg-transparent border-0 p-0 cursor-pointer w-fit"
              >
                <RefreshCw size={14} strokeWidth={2} />
                Refresh Prompts
              </button>

              <Composer
                textareaRef={textareaRef}
                input={input}
                loading={loading}
                MAX={MAX}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onSend={handleSend}
                placeholder="Ask whatever you want…"
                showAttachments
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
