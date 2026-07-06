"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Task {
  id: number;
  type: string;
  content: string;
  scheduledTransferAt?: string | null;
  transferred?: boolean;
  updatedAt?: string;
}

interface HistoryEntry {
  id: number;
  date: string;
  todayContent: string;
  tomorrowContent: string;
  savedAt: string;
}

interface CompletedTask {
  id: number;
  content: string;
  sourceType: string;
  completedAt: string;
}

interface RecycleItem {
  id: number;
  content: string;
  sourceType: string;
  originalDate: string;
  deletedAt: string;
  expiresAt: string;
}

interface SearchResult {
  id: number;
  type: "current" | "history" | "completed";
  sourceType: string;
  content: string;
  date: string;
}

type ModalType =
  | null
  | "menu"
  | "dots"
  | "history"
  | "completed"
  | "recycle"
  | "settings"
  | "search"
  | "saveConfirm"
  | "editToday"
  | "editTomorrow"
  | "deleteConfirm";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function timeUntilTransfer(isoDate?: string | null) {
  if (!isoDate) return null;
  const diff = new Date(isoDate).getTime() - Date.now();
  if (diff <= 0) return "Transfer pending…";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `Transfers in ${h}h ${m}m`;
  return `Transfers in ${m}m`;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Home() {
  // Core state
  const [todayContent, setTodayContent] = useState("");
  const [tomorrowContent, setTomorrowContent] = useState("");
  const [todayTask, setTodayTask] = useState<Task | null>(null);
  const [tomorrowTask, setTomorrowTask] = useState<Task | null>(null);

  // UI state
  const [modal, setModal] = useState<ModalType>(null);
  const [saving, setSaving] = useState<"today" | "tomorrow" | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [transferMsg, setTransferMsg] = useState<string | null>(null);

  // Modal data state
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [completed, setCompleted] = useState<CompletedTask[]>([]);
  const [recycle, setRecycle] = useState<RecycleItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<"today" | "tomorrow" | null>(null);
  const [editText, setEditText] = useState("");
  const [editTarget, setEditTarget] = useState<"today" | "tomorrow" | null>(null);

  // Settings
  const [theme, setTheme] = useState<"dark" | "slightly-dark" | "amoled">("dark");
  const [fontSize, setFontSize] = useState<"small" | "medium" | "large">("medium");
  const [autoSaveInterval, setAutoSaveInterval] = useState(3); // seconds

  // Refs for debounce
  const saveTimerToday = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimerTomorrow = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load initial data ──────────────────────────────────────────────────────
  useEffect(() => {
    fetchTasks();
    fetchSettings();
    checkTransfer();
    // Check transfer every 60 seconds
    const interval = setInterval(checkTransfer, 60000);
    return () => clearInterval(interval);
  }, []);

  async function fetchTasks() {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      if (data.today) {
        setTodayTask(data.today);
        setTodayContent(data.today.content || "");
      }
      if (data.tomorrow) {
        setTomorrowTask(data.tomorrow);
        setTomorrowContent(data.tomorrow.content || "");
      }
    } catch (err) {
      console.error("Failed to fetch tasks", err);
    }
  }

  async function fetchSettings() {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data.settings) {
        if (data.settings.theme) setTheme(data.settings.theme as typeof theme);
        if (data.settings.fontSize) setFontSize(data.settings.fontSize as typeof fontSize);
        if (data.settings.autoSaveInterval)
          setAutoSaveInterval(parseInt(data.settings.autoSaveInterval));
      }
    } catch (err) {
      console.error("Failed to fetch settings", err);
    }
  }

  async function checkTransfer() {
    try {
      const res = await fetch("/api/tasks/transfer", { method: "POST" });
      const data = await res.json();
      if (data.transferred) {
        setTransferMsg("✅ Tomorrow's tasks have been moved to Today!");
        fetchTasks();
        setTimeout(() => setTransferMsg(null), 5000);
      }
    } catch (err) {
      console.error("Transfer check failed", err);
    }
  }

  // ── Auto-save with debounce ────────────────────────────────────────────────
  const saveTask = useCallback(async (type: "today" | "tomorrow", content: string) => {
    setSaving(type);
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, content }),
      });
      const res = await fetch("/api/tasks");
      const data = await res.json();
      if (data.today) setTodayTask(data.today);
      if (data.tomorrow) setTomorrowTask(data.tomorrow);
      showSaveMsg("✓ Saved");
    } catch (err) {
      console.error("Save failed", err);
    } finally {
      setSaving(null);
    }
  }, []);

  function showSaveMsg(msg: string) {
    setSaveMsg(msg);
    setTimeout(() => setSaveMsg(null), 2000);
  }

  const handleTodayChange = (val: string) => {
    setTodayContent(val);
    if (saveTimerToday.current) clearTimeout(saveTimerToday.current);
    saveTimerToday.current = setTimeout(
      () => saveTask("today", val),
      autoSaveInterval * 1000
    );
  };

  const handleTomorrowChange = (val: string) => {
    setTomorrowContent(val);
    if (saveTimerTomorrow.current) clearTimeout(saveTimerTomorrow.current);
    saveTimerTomorrow.current = setTimeout(
      () => saveTask("tomorrow", val),
      autoSaveInterval * 1000
    );
  };

  // ── Modal Openers ──────────────────────────────────────────────────────────
  async function openHistory() {
    const res = await fetch("/api/history");
    const data = await res.json();
    setHistory(data.history || []);
    setModal("history");
  }

  async function openCompleted() {
    const res = await fetch("/api/completed");
    const data = await res.json();
    setCompleted(data.completed || []);
    setModal("completed");
  }

  async function openRecycle() {
    const res = await fetch("/api/recycle");
    const data = await res.json();
    setRecycle(data.items || []);
    setModal("recycle");
  }

  async function openSearch() {
    setSearchQuery("");
    setSearchResults([]);
    setModal("search");
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  async function saveToHistory() {
    await fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        todayContent,
        tomorrowContent,
      }),
    });
    showSaveMsg("✓ Plan saved to history!");
    setModal(null);
  }

  async function deleteTask(type: "today" | "tomorrow") {
    await fetch("/api/tasks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    if (type === "today") setTodayContent("");
    else setTomorrowContent("");
    fetchTasks();
    setModal(null);
    showSaveMsg("Task moved to recycle bin");
  }

  async function restoreFromRecycle(id: number) {
    await fetch("/api/recycle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchTasks();
    openRecycle();
    showSaveMsg("✓ Restored!");
  }

  async function permanentDelete(id: number) {
    await fetch("/api/recycle", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    openRecycle();
  }

  async function deleteCompleted(id: number) {
    await fetch("/api/completed", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    openCompleted();
  }

  async function markCompleted(type: "today" | "tomorrow") {
    const content = type === "today" ? todayContent : tomorrowContent;
    if (!content.trim()) return;
    await fetch("/api/completed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, sourceType: type }),
    });
    showSaveMsg("✓ Marked as completed!");
  }

  async function doSearch(q: string) {
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } finally {
      setSearchLoading(false);
    }
  }

  function openEdit(type: "today" | "tomorrow") {
    setEditTarget(type);
    setEditText(type === "today" ? todayContent : tomorrowContent);
    setModal(type === "today" ? "editToday" : "editTomorrow");
  }

  async function saveEdit() {
    if (!editTarget) return;
    const type = editTarget;
    const text = editText;
    if (type === "today") setTodayContent(text);
    else setTomorrowContent(text);
    await saveTask(type, text);
    setModal(null);
  }

  async function saveSetting(key: string, value: string) {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
  }

  async function deleteHistory(id: number) {
    await fetch("/api/history", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    openHistory();
  }

  // ── Theme classes ──────────────────────────────────────────────────────────
  const bgClass =
    theme === "amoled"
      ? "bg-black"
      : theme === "slightly-dark"
      ? "bg-gray-900"
      : "bg-[#0a0a0a]";

  const cardBg =
    theme === "amoled"
      ? "bg-black border border-gray-800"
      : theme === "slightly-dark"
      ? "bg-gray-800 border border-gray-700"
      : "bg-[#111111] border border-gray-800";

  const textSize =
    fontSize === "small"
      ? "text-sm"
      : fontSize === "large"
      ? "text-lg"
      : "text-base";

  const transferInfo = timeUntilTransfer(tomorrowTask?.scheduledTransferAt);

  return (
    <div className={`min-h-screen ${bgClass} text-white ${textSize} select-none`}>
      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur border-b border-gray-800/60">
        {/* Left: Three-dot (vertical) menu */}
        <button
          onClick={() => setModal("dots")}
          className="p-2 rounded-xl hover:bg-gray-800 transition-colors active:scale-95"
          aria-label="Options"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>

        {/* Center: Title */}
        <div className="text-center">
          <h1 className="text-xl font-bold tracking-wide text-white">Daily Working Plans</h1>
          <p className="text-xs text-gray-400">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
        </div>

        {/* Right: Hamburger menu */}
        <button
          onClick={() => setModal("menu")}
          className="p-2 rounded-xl hover:bg-gray-800 transition-colors active:scale-95"
          aria-label="Menu"
        >
          <svg width="24" height="22" viewBox="0 0 28 24" fill="none">
            <rect y="0" width="28" height="3" rx="2" fill="white" />
            <rect y="9" width="22" height="3" rx="2" fill="white" />
            <rect y="18" width="18" height="3" rx="2" fill="white" />
          </svg>
        </button>
      </div>

      {/* ── Transfer Notification ────────────────────────────────────────────── */}
      {transferMsg && (
        <div className="mx-4 mt-3 px-4 py-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-sm font-medium animate-pulse">
          {transferMsg}
        </div>
      )}

      {/* ── Auto-save indicator ──────────────────────────────────────────────── */}
      {(saving || saveMsg) && (
        <div className="fixed top-16 right-4 z-50 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-full text-xs text-gray-300 shadow-lg">
          {saving ? (
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />
              Saving…
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
              {saveMsg}
            </span>
          )}
        </div>
      )}

      {/* ── Main Content ─────────────────────────────────────────────────────── */}
      <div className="px-4 py-5 space-y-6 pb-24">
        {/* TODAY */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">📋</span>
              <h2 className="font-bold text-white text-lg">Today Tasks Plan</h2>
              <span className="text-xs text-gray-500">
                {todayContent.trim().split("\n").filter(Boolean).length} task(s)
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => markCompleted("today")}
                className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
                title="Mark as completed"
              >
                ✓ Done
              </button>
              <button
                onClick={() => openEdit("today")}
                className="text-xs px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
              >
                ✏️ Edit
              </button>
            </div>
          </div>
          <div className={`relative rounded-2xl ${cardBg} shadow-lg`}>
            <textarea
              value={todayContent}
              onChange={(e) => handleTodayChange(e.target.value)}
              placeholder="Write your today's tasks here…"
              className="w-full bg-transparent text-white placeholder-gray-600 p-4 rounded-2xl resize-none outline-none leading-relaxed min-h-[180px]"
              style={{ caretColor: "#60a5fa" }}
            />
            <div className="absolute bottom-3 right-3 text-xs text-gray-600">
              {todayContent.length} chars
            </div>
          </div>
          {todayTask?.updatedAt && (
            <p className="text-xs text-gray-600 mt-1 ml-1">
              Last saved: {formatDate(todayTask.updatedAt)}
            </p>
          )}
        </section>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent" />
          <span className="text-gray-600 text-xs">⏱ 24h auto-transfer</span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent" />
        </div>

        {/* TOMORROW */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">🗓️</span>
              <h2 className="font-bold text-white text-lg">Tomorrow Tasks Plan</h2>
              <span className="text-xs text-gray-500">
                {tomorrowContent.trim().split("\n").filter(Boolean).length} task(s)
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => markCompleted("tomorrow")}
                className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
              >
                ✓ Done
              </button>
              <button
                onClick={() => openEdit("tomorrow")}
                className="text-xs px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 transition-colors"
              >
                ✏️ Edit
              </button>
            </div>
          </div>
          <div className={`relative rounded-2xl ${cardBg} shadow-lg`}>
            <textarea
              value={tomorrowContent}
              onChange={(e) => handleTomorrowChange(e.target.value)}
              placeholder="Plan your tomorrow's tasks here…"
              className="w-full bg-transparent text-white placeholder-gray-600 p-4 rounded-2xl resize-none outline-none leading-relaxed min-h-[180px]"
              style={{ caretColor: "#a78bfa" }}
            />
            <div className="absolute bottom-3 right-3 text-xs text-gray-600">
              {tomorrowContent.length} chars
            </div>
          </div>
          {transferInfo && (
            <div className="flex items-center gap-1.5 mt-2 ml-1">
              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
              <p className="text-xs text-amber-400">{transferInfo}</p>
            </div>
          )}
          {tomorrowTask?.updatedAt && (
            <p className="text-xs text-gray-600 mt-1 ml-1">
              Last saved: {formatDate(tomorrowTask.updatedAt)}
            </p>
          )}
        </section>
      </div>

      {/* ── Bottom Quick Actions Bar ─────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-black/90 backdrop-blur border-t border-gray-800/60 px-6 py-3 flex justify-around">
        <button
          onClick={() => saveTask("today", todayContent)}
          className="flex flex-col items-center gap-0.5 text-blue-400 hover:text-blue-300 transition-colors active:scale-95"
        >
          <span className="text-xl">💾</span>
          <span className="text-[10px]">Save Today</span>
        </button>
        <button
          onClick={() => saveTask("tomorrow", tomorrowContent)}
          className="flex flex-col items-center gap-0.5 text-purple-400 hover:text-purple-300 transition-colors active:scale-95"
        >
          <span className="text-xl">💾</span>
          <span className="text-[10px]">Save Tomorrow</span>
        </button>
        <button
          onClick={openSearch}
          className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-white transition-colors active:scale-95"
        >
          <span className="text-xl">🔍</span>
          <span className="text-[10px]">Search</span>
        </button>
        <button
          onClick={openHistory}
          className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-white transition-colors active:scale-95"
        >
          <span className="text-xl">📜</span>
          <span className="text-[10px]">History</span>
        </button>
        <button
          onClick={() => setModal("settings")}
          className="flex flex-col items-center gap-0.5 text-gray-400 hover:text-white transition-colors active:scale-95"
        >
          <span className="text-xl">⚙️</span>
          <span className="text-[10px]">Settings</span>
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODALS */}
      {/* ══════════════════════════════════════════════════════════════════════ */}

      {/* ── Backdrop ─────────────────────────────────────────────────────────── */}
      {modal && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
          onClick={() => setModal(null)}
        />
      )}

      {/* ── Left Menu (Hamburger) ────────────────────────────────────────────── */}
      <div
        className={`fixed top-0 right-0 h-full w-72 z-50 bg-[#0d0d0d] border-l border-gray-800 shadow-2xl transition-transform duration-300 ${
          modal === "menu" ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-lg font-bold text-white">Menu</h2>
          <button onClick={() => setModal(null)} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>
        <nav className="p-4 space-y-1">
          {[
            { icon: "📜", label: "Tasks History", action: openHistory },
            { icon: "✅", label: "Completed Tasks", action: openCompleted },
            { icon: "💾", label: "Save Works Plan", action: () => { setModal("saveConfirm"); } },
            { icon: "⚙️", label: "Settings", action: () => setModal("settings") },
            { icon: "🔍", label: "Search", action: openSearch },
          ].map(({ icon, label, action }) => (
            <button
              key={label}
              onClick={action}
              className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-gray-800 text-left transition-colors group"
            >
              <span className="text-xl">{icon}</span>
              <span className="text-white font-medium group-hover:text-blue-300 transition-colors">{label}</span>
            </button>
          ))}
        </nav>
        <div className="absolute bottom-6 left-0 right-0 px-5">
          <div className="text-xs text-gray-600 text-center">Daily Working Plans</div>
          <div className="text-xs text-gray-700 text-center mt-0.5">Auto-saves every {autoSaveInterval}s</div>
        </div>
      </div>

      {/* ── Right Three-dot Menu ────────────────────────────────────────────── */}
      <div
        className={`fixed top-0 left-0 h-full w-72 z-50 bg-[#0d0d0d] border-r border-gray-800 shadow-2xl transition-transform duration-300 ${
          modal === "dots" ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-lg font-bold text-white">Options</h2>
          <button onClick={() => setModal(null)} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>
        <nav className="p-4 space-y-1">
          {[
            { icon: "🔍", label: "Search", action: openSearch },
            { icon: "🗑️", label: "Delete Task", action: () => { setModal("deleteConfirm"); setDeleteTarget(null); } },
            { icon: "♻️", label: "Recycle Bin", action: openRecycle },
            { icon: "✏️", label: "Edit Tasks", action: () => openEdit("today") },
          ].map(({ icon, label, action }) => (
            <button
              key={label}
              onClick={action}
              className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-gray-800 text-left transition-colors group"
            >
              <span className="text-xl">{icon}</span>
              <span className="text-white font-medium group-hover:text-red-300 transition-colors">{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* ── Delete Confirm Modal ─────────────────────────────────────────────── */}
      {modal === "deleteConfirm" && (
        <div className="fixed inset-0 z-60 flex items-center justify-center px-4">
          <div className="bg-[#111] border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">Delete Task</h3>
            <p className="text-gray-400 text-sm mb-4">Choose which task to delete. It will be moved to the Recycle Bin.</p>
            <div className="space-y-3">
              <button
                onClick={() => deleteTask("today")}
                className="w-full py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors font-medium"
              >
                🗑️ Delete Today&apos;s Tasks
              </button>
              <button
                onClick={() => deleteTask("tomorrow")}
                className="w-full py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors font-medium"
              >
                🗑️ Delete Tomorrow&apos;s Tasks
              </button>
              <button
                onClick={() => setModal(null)}
                className="w-full py-3 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Save Confirm Modal ───────────────────────────────────────────────── */}
      {modal === "saveConfirm" && (
        <div className="fixed inset-0 z-60 flex items-center justify-center px-4">
          <div className="bg-[#111] border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">Save Works Plan</h3>
            <p className="text-gray-400 text-sm mb-5">Save current today & tomorrow plans to history archive?</p>
            <div className="space-y-3">
              <button
                onClick={saveToHistory}
                className="w-full py-3 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:bg-blue-500/30 transition-colors font-medium"
              >
                💾 Save to History
              </button>
              <button
                onClick={() => setModal(null)}
                className="w-full py-3 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ───────────────────────────────────────────────────────── */}
      {(modal === "editToday" || modal === "editTomorrow") && (
        <div className="fixed inset-0 z-60 flex items-end justify-center px-0">
          <div className="bg-[#0d0d0d] border-t border-gray-800 rounded-t-2xl w-full max-w-lg shadow-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-white">
                ✏️ Edit {modal === "editToday" ? "Today" : "Tomorrow"}&apos;s Tasks
              </h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full bg-gray-900 text-white border border-gray-700 rounded-xl p-3 min-h-[220px] outline-none resize-none leading-relaxed"
              autoFocus
            />
            <div className="flex gap-3 mt-3">
              <button
                onClick={saveEdit}
                className="flex-1 py-2.5 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-300 font-medium hover:bg-blue-500/30 transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => setModal(null)}
                className="flex-1 py-2.5 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── History Modal ────────────────────────────────────────────────────── */}
      {modal === "history" && (
        <div className="fixed inset-0 z-60 flex items-end justify-center">
          <div className="bg-[#0d0d0d] border-t border-gray-800 rounded-t-2xl w-full max-w-lg shadow-2xl flex flex-col" style={{ maxHeight: "80vh" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 flex-shrink-0">
              <h3 className="text-base font-bold text-white">📜 Tasks History</h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {history.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No history yet. Save your plans using &quot;Save Works Plan&quot;.</p>
              ) : (
                history.map((h) => (
                  <div key={h.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-bold text-blue-400 uppercase tracking-wide">{h.date}</span>
                      <button
                        onClick={() => deleteHistory(h.id)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                    {h.todayContent && (
                      <div className="mb-2">
                        <p className="text-xs text-gray-500 mb-0.5">📋 Today:</p>
                        <p className="text-sm text-gray-300 whitespace-pre-wrap">{h.todayContent}</p>
                      </div>
                    )}
                    {h.tomorrowContent && (
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">🗓️ Tomorrow:</p>
                        <p className="text-sm text-gray-300 whitespace-pre-wrap">{h.tomorrowContent}</p>
                      </div>
                    )}
                    <p className="text-xs text-gray-600 mt-2">{formatDate(h.savedAt)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Completed Tasks Modal ────────────────────────────────────────────── */}
      {modal === "completed" && (
        <div className="fixed inset-0 z-60 flex items-end justify-center">
          <div className="bg-[#0d0d0d] border-t border-gray-800 rounded-t-2xl w-full max-w-lg shadow-2xl flex flex-col" style={{ maxHeight: "80vh" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 flex-shrink-0">
              <h3 className="text-base font-bold text-white">✅ Completed Tasks</h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {completed.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No completed tasks yet.</p>
              ) : (
                completed.map((c) => (
                  <div key={c.id} className="bg-gray-900 border border-emerald-900/40 rounded-xl p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <span className="text-xs text-emerald-400 font-medium uppercase">
                          {c.sourceType} plan
                        </span>
                        <p className="text-sm text-gray-200 whitespace-pre-wrap mt-1">{c.content}</p>
                        <p className="text-xs text-gray-600 mt-1">{formatDate(c.completedAt)}</p>
                      </div>
                      <button
                        onClick={() => deleteCompleted(c.id)}
                        className="ml-3 text-xs text-red-400 hover:text-red-300 flex-shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Recycle Bin Modal ────────────────────────────────────────────────── */}
      {modal === "recycle" && (
        <div className="fixed inset-0 z-60 flex items-end justify-center">
          <div className="bg-[#0d0d0d] border-t border-gray-800 rounded-t-2xl w-full max-w-lg shadow-2xl flex flex-col" style={{ maxHeight: "80vh" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 flex-shrink-0">
              <h3 className="text-base font-bold text-white">♻️ Recycle Bin</h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {recycle.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Recycle bin is empty.</p>
              ) : (
                recycle.map((r) => (
                  <div key={r.id} className="bg-gray-900 border border-red-900/30 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs text-red-400 font-medium uppercase">{r.sourceType} plan</span>
                      <span className="text-xs text-gray-600">{r.originalDate}</span>
                    </div>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap mb-3">{r.content}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => restoreFromRecycle(r.id)}
                        className="flex-1 py-1.5 text-xs rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                      >
                        ↩ Restore
                      </button>
                      <button
                        onClick={() => permanentDelete(r.id)}
                        className="flex-1 py-1.5 text-xs rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors"
                      >
                        🗑️ Delete Forever
                      </button>
                    </div>
                    <p className="text-xs text-gray-700 mt-2">Expires: {formatDate(r.expiresAt)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Search Modal ─────────────────────────────────────────────────────── */}
      {modal === "search" && (
        <div className="fixed inset-0 z-60 flex items-start justify-center pt-16 px-4">
          <div className="bg-[#0d0d0d] border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col" style={{ maxHeight: "80vh" }}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
              <span className="text-gray-400">🔍</span>
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value.trim().length >= 2) doSearch(e.target.value);
                  else setSearchResults([]);
                }}
                placeholder="Search tasks, history, completed…"
                className="flex-1 bg-transparent text-white placeholder-gray-600 outline-none text-base"
              />
              <button onClick={() => setModal(null)} className="text-gray-500 hover:text-white text-xl">&times;</button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {searchLoading && (
                <p className="text-gray-500 text-center py-4 text-sm">Searching…</p>
              )}
              {!searchLoading && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                <p className="text-gray-500 text-center py-8 text-sm">No results found for &quot;{searchQuery}&quot;</p>
              )}
              {!searchLoading && searchResults.map((r) => (
                <div key={`${r.type}-${r.id}`} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-xs font-semibold uppercase ${
                      r.type === "current" ? "text-blue-400" :
                      r.type === "history" ? "text-purple-400" : "text-emerald-400"
                    }`}>
                      {r.type === "current" ? "📋 Current" : r.type === "history" ? "📜 History" : "✅ Completed"}
                    </span>
                    <span className="text-xs text-gray-600">{r.date.split("T")[0]}</span>
                  </div>
                  <p className="text-sm text-gray-300 whitespace-pre-wrap line-clamp-3">{r.content}</p>
                </div>
              ))}
              {!searchQuery.trim() && (
                <div className="text-center py-8">
                  <p className="text-4xl mb-3">🔍</p>
                  <p className="text-gray-500 text-sm">Type at least 2 characters to search</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Settings Modal ───────────────────────────────────────────────────── */}
      {modal === "settings" && (
        <div className="fixed inset-0 z-60 flex items-end justify-center">
          <div className="bg-[#0d0d0d] border-t border-gray-800 rounded-t-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h3 className="text-base font-bold text-white">⚙️ Settings</h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <div className="p-5 space-y-6">
              {/* Theme */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">🎨 Theme</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["dark", "slightly-dark", "amoled"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setTheme(t);
                        saveSetting("theme", t);
                      }}
                      className={`py-2 rounded-xl text-xs font-medium border transition-colors ${
                        theme === t
                          ? "bg-blue-500/30 border-blue-500 text-blue-300"
                          : "bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700"
                      }`}
                    >
                      {t === "dark" ? "Dark" : t === "slightly-dark" ? "Gray Dark" : "AMOLED"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Size */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">🔤 Font Size</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["small", "medium", "large"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => {
                        setFontSize(f);
                        saveSetting("fontSize", f);
                      }}
                      className={`py-2 rounded-xl text-xs font-medium border transition-colors ${
                        fontSize === f
                          ? "bg-purple-500/30 border-purple-500 text-purple-300"
                          : "bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700"
                      }`}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto-save Interval */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  ⏱ Auto-save Interval: <span className="text-blue-400">{autoSaveInterval}s</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={autoSaveInterval}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    setAutoSaveInterval(v);
                    saveSetting("autoSaveInterval", String(v));
                  }}
                  className="w-full accent-blue-500"
                />
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>1s</span><span>10s</span>
                </div>
              </div>

              {/* Info */}
              <div className="bg-gray-900 rounded-xl p-3 border border-gray-800">
                <p className="text-xs text-gray-500 leading-relaxed">
                  📌 <strong className="text-gray-400">Auto-transfer:</strong> Tomorrow&apos;s tasks automatically move to Today after 24 hours of being saved.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
