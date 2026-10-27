import type { ConversationSummary } from "../lib/api";
import { BrainIcon, ChecklistIcon, LogOutIcon, PlusIcon, SearchIcon, SettingsIcon, SparkIcon, XIcon } from "./Icons";

type SidebarProps = {
  mode: "connected" | "local";
  user: { name: string; email: string } | null;
  conversations: ConversationSummary[];
  activeId: string | null;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onOpenMemory: () => void;
  onOpenTasks: () => void;
  taskCount?: number;
  onSignOut: () => void;
  open?: boolean;
  onClose?: () => void;
};

const GROUPS = ["Today", "Yesterday", "Previous 7 days", "Older"] as const;
type Group = (typeof GROUPS)[number];

function groupOf(iso: string): Group {
  const d = new Date(iso);
  const now = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.floor((day(now) - day(d)) / 86_400_000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays <= 7) return "Previous 7 days";
  return "Older";
}

export default function Sidebar({
  mode,
  user,
  conversations,
  activeId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onOpenMemory,
  onOpenTasks,
  taskCount = 0,
  onSignOut,
  open,
  onClose,
}: SidebarProps) {
  const initial = (user?.name?.[0] ?? "G").toUpperCase();

  return (
    <>
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 flex flex-col border-r border-ink-800 bg-ink-900 transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full"}`}>
      
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
        <SparkIcon className="size-6" />
        <span className="font-display text-[17px] font-semibold tracking-tight text-ink-100">
          Aurora
        </span>
        <span className="ml-auto rounded-md bg-ink-800 px-1.5 py-0.5 text-[10px] font-medium text-ink-300 ring-1 ring-ink-700">
          v0.2
        </span>
      </div>

      {/* Actions */}
      <div className="px-4">
        <button
          type="button"
          onClick={onNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-500 px-3.5 py-2.5 text-sm font-medium text-ink-950 transition-colors hover:bg-accent-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300"
        >
          <PlusIcon className="size-4" />
          New chat
        </button>
        <button
          type="button"
          title="Search arrives in a later phase"
          className="mt-2 flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100"
        >
          <SearchIcon className="size-4" />
          Search chats
          <span className="ml-auto rounded-md bg-ink-800 px-1.5 py-0.5 text-[10px] font-medium text-ink-400 ring-1 ring-ink-700">⌘K</span>
        </button>
        <button
          type="button"
          onClick={onOpenMemory}
          disabled={mode === "local"}
          title={mode === "local" ? "Memory needs a database connection" : "Review what Aurora remembers"}
          className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100 disabled:cursor-not-allowed disabled:text-ink-500 disabled:hover:bg-transparent"
        >
          <BrainIcon className="size-4" />
          Memory
        </button>
        <button
          type="button"
          onClick={onOpenTasks}
          disabled={mode === "local"}
          title={mode === "local" ? "Tasks need a database connection" : "Your to-dos and reminders"}
          className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100 disabled:cursor-not-allowed disabled:text-ink-500 disabled:hover:bg-transparent"
        >
          <ChecklistIcon className="size-4" />
          Tasks
          {taskCount > 0 && (
            <span className="ml-auto rounded-md bg-accent-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent-300 ring-1 ring-accent-500/25">
              {taskCount}
            </span>
          )}
        </button>
      </div>

      {/* Conversation history */}
      <nav className="mt-5 flex-1 space-y-5 overflow-y-auto px-4 pb-4" aria-label="Conversations">
        {mode === "local" ? (
          <div className="rounded-xl bg-ink-850 px-3.5 py-3 text-[12px] leading-relaxed text-ink-400 ring-1 ring-ink-700">
            <p className="mb-1 font-medium text-ink-300">Local mode</p>
            Chats live in memory only. Add{" "}
            <code className="rounded bg-ink-800 px-1 py-0.5 text-[11px] text-accent-300">
              NEON_DATABASE_URL
            </code>{" "}
            to <span className="text-ink-300">server/.env</span> to unlock accounts and saved
            history.
          </div>
        ) : conversations.length === 0 ? (
          <p className="px-2 text-[13px] text-ink-500">No conversations yet — start one below.</p>
        ) : (
          GROUPS.map((group) => {
            const items = conversations.filter((c) => groupOf(c.updatedAt) === group);
            if (items.length === 0) return null;
            return (
              <div key={group}>
                <p className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-500">
                  {group}
                </p>
                <ul className="space-y-0.5">
                  {items.map((c) => (
                    <li key={c.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => onSelectConversation(c.id)}
                        title={c.title}
                        className={`w-full truncate rounded-lg py-2 pl-2.5 pr-10 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-500 ${
                          c.id === activeId
                            ? "bg-ink-800 text-ink-100"
                            : "text-ink-300 hover:bg-ink-850 hover:text-ink-100"
                        }`}
                      >
                        {c.title}
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete conversation: ${c.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConversation(c.id);
                        }}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-500 opacity-0 transition-opacity hover:bg-ink-700 hover:text-ink-200 focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <XIcon className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </nav>

      {/* User card */}
      <div className="border-t border-ink-800 p-4">
        <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink-700 font-display text-sm font-semibold text-accent-300 ring-1 ring-ink-600">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink-100">{user?.name ?? "Guest"}</p>
            <p className="truncate text-[11px] text-ink-400">
              {user?.email ?? "Local mode — no history"}
            </p>
          </div>
          {user && (
            <button
              type="button"
              aria-label="Sign out"
              title="Sign out"
              onClick={onSignOut}
              className="ml-auto rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100"
            >
              <LogOutIcon className="size-4" />
            </button>
          )}
          <button
            type="button"
            aria-label="Settings"
            title="Settings — coming soon"
            className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100"
          >
            <SettingsIcon className="size-4" />
          </button>
        </div>
      </div>
    </aside>
    </>
  );
}
