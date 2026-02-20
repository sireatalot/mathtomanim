import { useState, useRef, useCallback, useEffect } from "react";
import {
  Plus,
  Search,
  Home,
  Folder,
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
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Prompt {
  id: number;
  text: string;
  Icon: React.ElementType;
}

type Message =
  | { id: number; type: "user"; text: string }
  | {
      id: number;
      type: "bot";
      status: "loading" | "done" | "error";
      videoUrl?: string;
      sceneName?: string;
      error?: string;
    };

// ── Data ──────────────────────────────────────────────────────────────────────

const ALL_PROMPTS: Prompt[] = [
  { id: 1, text: "Animate the sine and cosine waves", Icon: SlidersHorizontal },
  { id: 2, text: "Show the Pythagorean theorem visually", Icon: FileText },
  { id: 3, text: "Visualize how a neural network works", Icon: Mail },
  { id: 4, text: "Animate bubble sort algorithm step by step", Icon: User },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SidebarIconBtn({
  Icon,
  label,
}: {
  Icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      aria-label={label}
      className="w-9 h-9 flex items-center justify-center rounded-lg text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors duration-150 cursor-pointer border-0 bg-transparent p-0"
    >
      <Icon size={18} strokeWidth={1.75} />
    </button>
  );
}

function PromptCard({
  prompt,
  onClick,
}: {
  prompt: Prompt;
  onClick: (text: string) => void;
}) {
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

function BotBubble({ msg }: { msg: Extract<Message, { type: "bot" }> }) {
  if (msg.status === "loading") {
    return (
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-full bg-neutral-800 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Triangle size={12} className="text-white fill-white" />
        </div>
        <div className="flex items-center gap-2 text-sm text-neutral-500 py-2">
          <Loader2 size={14} className="animate-spin" />
          Generating animation…
        </div>
      </div>
    );
  }

  if (msg.status === "error") {
    return (
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-full bg-neutral-800 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Triangle size={12} className="text-white fill-white" />
        </div>
        <div className="flex items-center gap-2 text-sm text-red-400 py-2">
          <AlertCircle size={14} />
          {msg.error ?? "Something went wrong."}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-full bg-neutral-800 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Triangle size={12} className="text-white fill-white" />
      </div>
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

// ── Main App ──────────────────────────────────────────────────────────────────

let nextId = 1;

export default function App() {
  const [prompts, setPrompts] = useState<Prompt[]>(ALL_PROMPTS);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const MAX = 1000;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

    setMessages((prev) => [
      ...prev,
      { id: userId, type: "user", text: msg },
      { id: botId, type: "bot", status: "loading" },
    ]);

    try {
      const res = await fetch("http://localhost:8000/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: msg }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? "Server error");
      }

      const data = await res.json();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botId
            ? {
                id: botId,
                type: "bot",
                status: "done",
                videoUrl: data.video_url,
                sceneName: data.scene_name,
              }
            : m,
        ),
      );
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : "Unknown error";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botId
            ? { id: botId, type: "bot", status: "error", error: errMsg }
            : m,
        ),
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
      <aside className="w-16 flex-shrink-0 bg-[#111111] border-r border-neutral-900 flex flex-col items-center py-4 gap-1">
        <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center mb-2">
          <Triangle size={16} className="text-black fill-black" />
        </div>
        <SidebarIconBtn Icon={Plus} label="New chat" />
        <div className="w-full h-px bg-neutral-800 my-1" />
        <SidebarIconBtn Icon={Search} label="Search" />
        <SidebarIconBtn Icon={Home} label="Home" />
        <SidebarIconBtn Icon={Folder} label="Files" />
        <SidebarIconBtn Icon={Clock} label="History" />
        <div className="flex-1" />
        <SidebarIconBtn Icon={Settings} label="Settings" />
        <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center mt-1 cursor-pointer">
          <User size={16} strokeWidth={1.5} className="text-neutral-400" />
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {inChat ? (
          /* ── Chat view ── */
          <>
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="max-w-3xl mx-auto flex flex-col gap-5">
                {messages.map((m) =>
                  m.type === "user" ? (
                    <UserBubble key={m.id} text={m.text} />
                  ) : (
                    <BotBubble key={m.id} msg={m} />
                  ),
                )}
                <div ref={bottomRef} />
              </div>
            </div>

            {/* Composer pinned at bottom */}
            <div className="px-6 py-4 border-t border-neutral-900">
              <div className="max-w-3xl mx-auto bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col gap-3">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything"
                  rows={2}
                  className="flex-1 resize-none bg-transparent border-0 outline-none text-sm text-neutral-200 placeholder-neutral-600 leading-relaxed min-h-[48px] max-h-40 font-[inherit] w-full"
                />
                <div className="flex items-center gap-4">
                  <span className="text-xs text-neutral-600 tabular-nums ml-auto">
                    {input.length}/{MAX}
                  </span>
                  <button
                    onClick={handleSend}
                    disabled={loading || !input.trim()}
                    aria-label="Send"
                    className="w-8 h-8 rounded-lg bg-white flex items-center justify-center hover:bg-neutral-200 active:scale-95 transition-all duration-100 cursor-pointer border-0 flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <Loader2 size={13} className="text-black animate-spin" />
                    ) : (
                      <ArrowRight
                        size={14}
                        className="text-black"
                        strokeWidth={2.5}
                      />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* ── Landing view ── */
          <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-6 py-10">
            <div className="w-full max-w-3xl flex flex-col gap-7">
              <div>
                <h1 className="text-4xl font-normal leading-tight tracking-tight text-neutral-500">
                  Hi there, what would you like to know?
                </h1>
                <p className="mt-4 text-sm text-neutral-500 leading-relaxed">
                  Describe a math or CS concept and I'll generate an animation
                  for you.
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

              {/* Composer */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col gap-3">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask whatever you want…"
                  rows={2}
                  className="flex-1 resize-none bg-transparent border-0 outline-none text-sm text-neutral-200 placeholder-neutral-600 leading-relaxed min-h-[48px] max-h-40 font-[inherit] w-full"
                />
                <div className="flex items-center gap-4">
                  <button className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors bg-transparent border-0 p-0 cursor-pointer">
                    <PlusCircle size={14} strokeWidth={1.75} />
                    Add Attachment
                  </button>
                  <button className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors bg-transparent border-0 p-0 cursor-pointer">
                    <Image size={14} strokeWidth={1.75} />
                    Use Image
                  </button>
                  <div className="flex-1" />
                  <span className="text-xs text-neutral-600 tabular-nums">
                    {input.length}/{MAX}
                  </span>
                  <button
                    onClick={handleSend}
                    disabled={loading || !input.trim()}
                    aria-label="Send"
                    className="w-8 h-8 rounded-lg bg-white flex items-center justify-center hover:bg-neutral-200 active:scale-95 transition-all duration-100 cursor-pointer border-0 flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <Loader2 size={13} className="text-black animate-spin" />
                    ) : (
                      <ArrowRight
                        size={14}
                        className="text-black"
                        strokeWidth={2.5}
                      />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
