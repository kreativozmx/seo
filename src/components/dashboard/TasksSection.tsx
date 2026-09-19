"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ProjectDTO } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { TranslationKey } from "@/lib/i18n/dictionaries";
import { TASK_STATUSES } from "@/lib/taskStatus";

interface Task {
  id: string;
  title: string;
  status: string;
  ownerId: string | null;
  startDate: string | null;
  endDate: string | null;
  commentCount: number;
}
interface Member {
  id: string;
  name: string;
  email: string;
  accessToken?: string;
}
interface Comment {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
}

const AVATAR_COLORS = ["#579bfc", "#a25ddc", "#00c875", "#fdab3d", "#df2f4a", "#037f4c", "#7e3b8a"];
const INVITE_VALUE = "__invite__";
const GRID = "grid grid-cols-[28px_minmax(220px,1fr)_52px_190px_170px_150px] items-center";

function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  return (
    <span
      className="inline-flex items-center justify-center rounded-full text-white font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.42, background: AVATAR_COLORS[hash % AVATAR_COLORS.length] }}
    >
      {initials || "?"}
    </span>
  );
}

function formatRange(start: string | null, end: string | null, locale: string): string | null {
  if (!start && !end) return null;
  const opts = (d: string) => new Date(`${d}T00:00:00Z`);
  const month = (d: string) => opts(d).toLocaleDateString(locale, { month: "short", timeZone: "UTC" });
  const day = (d: string) => opts(d).getUTCDate();
  if (start && end) {
    if (start === end) return `${month(start)} ${day(start)}`;
    return month(start) === month(end)
      ? `${month(start)} ${day(start)} - ${day(end)}`
      : `${month(start)} ${day(start)} - ${month(end)} ${day(end)}`;
  }
  const only = (start ?? end) as string;
  return `${month(only)} ${day(only)}`;
}

// Tareas tab: a monday-style task list per project — owner (incl. external
// people invited by email), status, timeline, and a conversation per task.
export function TasksSection({ project }: { project: ProjectDTO }) {
  const { t, dateLocale } = useLocale();
  const base = `/api/projects/${project.id}`;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [showPeople, setShowPeople] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [datesOpenFor, setDatesOpenFor] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [copiedLinkFor, setCopiedLinkFor] = useState<string | null>(null);

  const flash = useCallback((text: string, error = false) => {
    setNotice({ text, error });
    setTimeout(() => setNotice(null), 4000);
  }, []);

  useEffect(() => {
    fetch(`${base}/tasks`)
      .then((r) => r.json())
      .then((d) => {
        setTasks(d.tasks ?? []);
        setMembers(d.members ?? []);
      })
      .catch(() => flash(t("tasks.error"), true))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  async function patchTask(id: string, patch: Record<string, unknown>) {
    const before = tasks;
    setTasks((prev) => prev.map((x) => (x.id === id ? ({ ...x, ...patch } as Task) : x)));
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("tasks.error"));
      setTasks((prev) => prev.map((x) => (x.id === id ? data.task : x)));
      if (data.emailed === true) {
        const owner = members.find((m) => m.id === data.task.ownerId);
        flash(t("tasks.emailSent", { name: owner?.name ?? "" }));
      } else if (data.emailed === false) {
        flash(t("tasks.emailFailed", { error: data.emailError ?? "" }), true);
      }
    } catch (err) {
      setTasks(before);
      flash(err instanceof Error ? err.message : t("tasks.error"), true);
    }
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setNewTitle("");
    try {
      const res = await fetch(`${base}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTasks((prev) => [...prev, data.task]);
    } catch {
      setNewTitle(title);
      flash(t("tasks.error"), true);
    }
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(null);
    const res = await fetch(`${base}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: inviteName, email: inviteEmail }),
    });
    const data = await res.json();
    if (!res.ok) {
      setInviteError(data.error === "Correo invalido" ? t("notif.invalidEmail") : data.error || t("tasks.error"));
      return;
    }
    setMembers((prev) => [...prev, data.member]);
    setInviteName("");
    setInviteEmail("");
    if (data.emailed) flash(t("tasks.inviteSent", { email: data.member.email }));
    else flash(t("tasks.inviteNotSent"), true);
  }

  async function removeMember(id: string) {
    await fetch(`/api/members/${id}`, { method: "DELETE" });
    setMembers((prev) => prev.filter((m) => m.id !== id));
    setTasks((prev) => prev.map((x) => (x.ownerId === id ? { ...x, ownerId: null } : x)));
  }

  async function deleteTask(id: string) {
    if (!confirm(t("tasks.deleteConfirm"))) return;
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    setTasks((prev) => prev.filter((x) => x.id !== id));
    setSelectedId(null);
  }

  async function handleDrop(targetId: string) {
    const from = dragId;
    setDragId(null);
    setOverId(null);
    if (!from || from === targetId) return;
    const before = tasks;
    const next = [...tasks];
    const fromIndex = next.findIndex((x) => x.id === from);
    const toIndex = next.findIndex((x) => x.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setTasks(next);
    try {
      const res = await fetch(`${base}/tasks/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: next.map((x) => x.id) }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setTasks(before);
      flash(t("tasks.error"), true);
    }
  }

  async function copyMemberLink(m: Member) {
    if (!m.accessToken) return;
    await navigator.clipboard.writeText(`${window.location.origin}/tareas/${m.accessToken}`);
    setCopiedLinkFor(m.id);
    setTimeout(() => setCopiedLinkFor(null), 1800);
  }

  const selected = tasks.find((x) => x.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-medium text-neutral-900">{t("tasks.title")}</p>
            <p className="text-neutral-500 text-xs mt-0.5 max-w-2xl">{t("tasks.description")}</p>
          </div>
          <button
            onClick={() => setShowPeople((v) => !v)}
            className="text-xs bg-white border border-neutral-200 hover:border-neutral-300 text-neutral-700 font-medium rounded-md px-3 py-1.5 transition-colors whitespace-nowrap"
          >
            {t("tasks.invitePerson")}
            {members.length > 0 && <span className="text-neutral-400"> · {members.length}</span>}
          </button>
        </div>

        {showPeople && (
          <div className="mt-3 border-t border-neutral-100 pt-3">
            <p className="text-xs font-medium text-neutral-700 mb-2">{t("tasks.people")}</p>
            {members.length === 0 ? (
              <p className="text-xs text-neutral-400 mb-2">{t("tasks.noPeople")}</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {members.map((m) => (
                  <span
                    key={m.id}
                    title={m.email}
                    className="flex items-center gap-1.5 bg-neutral-50 border border-neutral-200 text-xs rounded-full pl-1.5 pr-2 py-1"
                  >
                    <Avatar name={m.name} size={20} />
                    <span className="text-neutral-700">{m.name}</span>
                    <span className="text-neutral-400">{m.email}</span>
                    <button
                      onClick={() => copyMemberLink(m)}
                      className="text-[#228449] hover:underline underline-offset-2"
                    >
                      {copiedLinkFor === m.id ? t("tasks.linkCopied") : t("tasks.copyLink")}
                    </button>
                    <button
                      onClick={() => removeMember(m.id)}
                      aria-label={t("tasks.invite.remove")}
                      className="text-neutral-400 hover:text-red-600 transition-colors"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <form onSubmit={addMember} className="flex flex-wrap items-center gap-2">
              <input
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder={t("tasks.invite.name")}
                className="w-40 bg-white border border-neutral-200 rounded-md px-2.5 py-1.5 text-xs outline-none focus:border-[#228449] transition-colors"
              />
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder={t("tasks.invite.email")}
                className="w-56 bg-white border border-neutral-200 rounded-md px-2.5 py-1.5 text-xs outline-none focus:border-[#228449] transition-colors"
              />
              <button
                type="submit"
                disabled={!inviteName.trim() || !inviteEmail.trim()}
                className="text-xs bg-[#228449] hover:bg-[#1B6B3A] disabled:opacity-50 text-white font-medium rounded-md px-3 py-1.5 transition-colors"
              >
                {t("tasks.invite.add")}
              </button>
            </form>
            {inviteError && <p className="text-xs text-red-600 mt-1">{inviteError}</p>}
            <p className="text-xs text-neutral-400 mt-2">{t("tasks.invite.hint")}</p>
          </div>
        )}
      </div>

      {notice && (
        <p className={`text-xs rounded-lg px-3 py-2 ${notice.error ? "text-red-700 bg-red-50" : "text-[#155D34] bg-[#E6F4EC]"}`}>
          {notice.text}
        </p>
      )}

      <div className="bg-white border border-neutral-200 rounded-xl overflow-x-auto">
        <div className="min-w-[780px]">
          <div className={`${GRID} text-[13px] text-neutral-500 border-b border-neutral-200 bg-neutral-50`}>
            <span />
            <span className="px-3 py-2">{t("tasks.col.task")}</span>
            <span />
            <span className="px-3 py-2 text-center">{t("tasks.col.owner")}</span>
            <span className="px-3 py-2 text-center">{t("tasks.col.status")}</span>
            <span className="px-3 py-2 text-center">{t("tasks.col.timeline")}</span>
          </div>

          {loading ? (
            <p className="text-xs text-neutral-400 px-3 py-4">…</p>
          ) : tasks.length === 0 ? (
            <p className="text-xs text-neutral-400 px-3 py-4">{t("tasks.empty")}</p>
          ) : (
            tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                members={members}
                dateLocale={dateLocale}
                datesOpen={datesOpenFor === task.id}
                onToggleDates={() => setDatesOpenFor(datesOpenFor === task.id ? null : task.id)}
                onPatch={(patch) => patchTask(task.id, patch)}
                onOpen={() => setSelectedId(task.id)}
                onInvite={() => setShowPeople(true)}
                dragging={dragId === task.id}
                dropTarget={overId === task.id && dragId !== null && dragId !== task.id}
                onDragStart={() => setDragId(task.id)}
                onDragOver={() => setOverId(task.id)}
                onDrop={() => handleDrop(task.id)}
                onDragEnd={() => {
                  setDragId(null);
                  setOverId(null);
                }}
              />
            ))
          )}

          <form onSubmit={addTask} className="border-t border-neutral-100">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={t("tasks.addPlaceholder")}
              className="w-full px-3 py-2.5 text-sm text-neutral-700 placeholder:text-neutral-400 outline-none bg-transparent focus:bg-neutral-50"
            />
          </form>
        </div>
      </div>

      {selected && (
        <TaskDrawer
          key={selected.id}
          task={selected}
          ownerName={members.find((m) => m.id === selected.ownerId)?.name ?? null}
          commentsUrl={`/api/tasks/${selected.id}/comments`}
          onClose={() => setSelectedId(null)}
          onDelete={() => deleteTask(selected.id)}
          onCommentAdded={() =>
            setTasks((prev) => prev.map((x) => (x.id === selected.id ? { ...x, commentCount: x.commentCount + 1 } : x)))
          }
        />
      )}
    </div>
  );
}

function TaskRow({
  task,
  members,
  dateLocale,
  datesOpen,
  onToggleDates,
  onPatch,
  onOpen,
  onInvite,
  guest = false,
  dragging = false,
  dropTarget = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  task: Task;
  members: Member[];
  dateLocale: string;
  datesOpen: boolean;
  onToggleDates: () => void;
  onPatch: (patch: Record<string, unknown>) => void;
  onOpen: () => void;
  onInvite?: () => void;
  guest?: boolean;
  dragging?: boolean;
  dropTarget?: boolean;
  onDragStart?: () => void;
  onDragOver?: () => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
}) {
  const { t } = useLocale();
  const [title, setTitle] = useState(task.title);
  const titleRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const status = TASK_STATUSES.find((s) => s.id === task.status) ?? TASK_STATUSES[3];
  const owner = members.find((m) => m.id === task.ownerId) ?? null;
  const range = formatRange(task.startDate, task.endDate, dateLocale);

  useEffect(() => setTitle(task.title), [task.title]);

  function commitTitle() {
    const next = title.trim();
    if (!next) return setTitle(task.title);
    if (next !== task.title) onPatch({ title: next });
  }

  return (
    <div
      ref={rowRef}
      onDragOver={
        guest
          ? undefined
          : (e) => {
              e.preventDefault();
              onDragOver?.();
            }
      }
      onDrop={
        guest
          ? undefined
          : (e) => {
              e.preventDefault();
              onDrop?.();
            }
      }
      className={`${GRID} border-b border-neutral-100 hover:bg-neutral-50/60 transition-colors ${
        dragging ? "opacity-40" : ""
      } ${dropTarget ? "shadow-[inset_0_2px_0_0_#228449]" : ""}`}
    >
      {guest ? (
        <span />
      ) : (
        <span
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", task.id);
            if (rowRef.current) e.dataTransfer.setDragImage(rowRef.current, 12, 16);
            onDragStart?.();
          }}
          onDragEnd={onDragEnd}
          title={t("tasks.dragHint")}
          aria-label={t("tasks.dragHint")}
          className="flex items-center justify-center h-full text-neutral-300 hover:text-neutral-500 cursor-grab active:cursor-grabbing select-none"
        >
          <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
            <circle cx="3" cy="3" r="1.3" /><circle cx="9" cy="3" r="1.3" />
            <circle cx="3" cy="8" r="1.3" /><circle cx="9" cy="8" r="1.3" />
            <circle cx="3" cy="13" r="1.3" /><circle cx="9" cy="13" r="1.3" />
          </svg>
        </span>
      )}
      {guest ? (
        <p className="px-3 py-2.5 text-sm text-neutral-800 break-words">{task.title}</p>
      ) : (
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => e.key === "Enter" && titleRef.current?.blur()}
          className="px-3 py-2.5 text-sm text-neutral-800 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-[#228449]/40 rounded"
        />
      )}

      <button
        onClick={onOpen}
        aria-label={t("tasks.detail.updates")}
        title={t("tasks.detail.updates")}
        className={`mx-auto flex items-center gap-1 text-xs transition-colors ${
          task.commentCount > 0 ? "text-blue-600" : "text-neutral-400 hover:text-neutral-600"
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
        </svg>
        {task.commentCount > 0 && <span>{task.commentCount}</span>}
      </button>

      <div className="px-3 flex items-center justify-center gap-2">
        {owner ? <Avatar name={owner.name} /> : <span className="w-6 h-6 rounded-full border border-dashed border-neutral-300 shrink-0" />}
        {guest ? (
          <span className="text-xs text-neutral-700 truncate max-w-[120px]">{owner?.name}</span>
        ) : (
        <select
          value={task.ownerId ?? ""}
          onChange={(e) => {
            if (e.target.value === INVITE_VALUE) return onInvite?.();
            onPatch({ ownerId: e.target.value || null });
          }}
          className="text-xs text-neutral-700 bg-transparent outline-none cursor-pointer max-w-[120px] truncate"
        >
          <option value="">{t("tasks.owner.none")}</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
          <option value={INVITE_VALUE}>{t("tasks.owner.invite")}</option>
        </select>
        )}
      </div>

      <div className="px-2">
        <select
          value={task.status}
          onChange={(e) => onPatch({ status: e.target.value })}
          style={{ background: status.bg, color: status.fg }}
          className="w-full h-8 rounded-md text-xs font-medium text-center outline-none cursor-pointer appearance-none px-2"
        >
          {TASK_STATUSES.map((s) => (
            <option key={s.id} value={s.id} style={{ background: "#fff", color: "#111" }}>
              {t(`tasks.status.${s.id}` as TranslationKey)}
            </option>
          ))}
        </select>
      </div>

      <div className="px-2 relative">
        <button
          onClick={onToggleDates}
          className={`w-full h-7 rounded-full text-xs font-medium transition-colors ${
            range ? "bg-[#323338] text-white hover:bg-black" : "bg-neutral-100 text-neutral-400 hover:bg-neutral-200"
          }`}
        >
          {range ?? t("tasks.timeline.none")}
        </button>
        {datesOpen && (
          <div className="absolute right-2 top-9 z-20 w-56 bg-white border border-neutral-200 rounded-lg shadow-lg p-3 flex flex-col gap-2">
            <label className="text-[12px] text-neutral-500 flex flex-col gap-1">
              {t("tasks.timeline.start")}
              <input
                type="date"
                value={task.startDate ?? ""}
                onChange={(e) => onPatch({ startDate: e.target.value || null })}
                className="border border-neutral-200 rounded-md px-2 py-1 text-xs text-neutral-800"
              />
            </label>
            <label className="text-[12px] text-neutral-500 flex flex-col gap-1">
              {t("tasks.timeline.end")}
              <input
                type="date"
                value={task.endDate ?? ""}
                min={task.startDate ?? undefined}
                onChange={(e) => onPatch({ endDate: e.target.value || null })}
                className="border border-neutral-200 rounded-md px-2 py-1 text-xs text-neutral-800"
              />
            </label>
            {(task.startDate || task.endDate) && (
              <button
                onClick={() => onPatch({ startDate: null, endDate: null })}
                className="text-xs text-neutral-400 hover:text-red-600 text-left transition-colors"
              >
                {t("tasks.timeline.clear")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TaskDrawer({
  task,
  ownerName,
  commentsUrl,
  onClose,
  onDelete,
  onCommentAdded,
}: {
  task: Task;
  ownerName: string | null;
  commentsUrl: string;
  onClose: () => void;
  onDelete?: () => void;
  onCommentAdded: () => void;
}) {
  const { t, dateLocale } = useLocale();
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const status = TASK_STATUSES.find((s) => s.id === task.status) ?? TASK_STATUSES[3];
  useEffect(() => {
    fetch(commentsUrl)
      .then((r) => r.json())
      .then((d) => setComments(d.comments ?? []))
      .catch(() => setComments([]));
  }, [commentsUrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setPosting(true);
    try {
      const res = await fetch(commentsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (res.ok) {
        setComments((prev) => [...(prev ?? []), data.comment]);
        setText("");
        onCommentAdded();
      }
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9000] flex justify-end bg-black/20" onClick={onClose}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] h-full bg-white shadow-2xl flex flex-col"
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-neutral-100">
          <div className="min-w-0">
            <p className="text-lg font-semibold text-neutral-900 leading-snug">{task.title}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-xs font-medium rounded px-2 py-0.5" style={{ background: status.bg, color: status.fg }}>
                {t(`tasks.status.${status.id}` as TranslationKey)}
              </span>
              {ownerName && (
                <span className="flex items-center gap-1.5 text-xs text-neutral-600">
                  <Avatar name={ownerName} size={20} /> {ownerName}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} aria-label={t("tasks.close")} className="text-neutral-400 hover:text-neutral-700 text-xl leading-none">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          <p className="text-[13px] text-neutral-400 uppercase tracking-wide">{t("tasks.detail.updates")}</p>
          {comments === null ? (
            <p className="text-xs text-neutral-400">…</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-neutral-400">{t("tasks.detail.noComments")}</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="bg-neutral-50 border border-neutral-100 rounded-xl px-3.5 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <Avatar name={c.authorName} size={22} />
                  <span className="text-xs font-medium text-neutral-800 truncate">{c.authorName}</span>
                  <span className="text-[12px] text-neutral-400 ml-auto shrink-0">
                    {new Date(c.createdAt).toLocaleString(dateLocale, {
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-sm text-neutral-700 whitespace-pre-wrap break-words">{c.body}</p>
              </div>
            ))
          )}
        </div>

        <form onSubmit={post} className="px-5 py-4 border-t border-neutral-100 flex flex-col gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) post(e);
            }}
            rows={3}
            placeholder={t("tasks.detail.placeholder")}
            className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#228449] transition-colors resize-none"
          />
          <div className="flex items-center justify-between">
            {onDelete ? (
              <button type="button" onClick={onDelete} className="text-xs text-neutral-400 hover:text-red-600 transition-colors">
                {t("tasks.delete")}
              </button>
            ) : (
              <span />
            )}
            <button
              type="submit"
              disabled={posting || !text.trim()}
              className="text-sm bg-[#228449] hover:bg-[#1B6B3A] disabled:opacity-50 text-white font-medium rounded-md px-4 py-1.5 transition-colors"
            >
              {t("tasks.detail.send")}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

// Guest view (/tareas/{token}): the invited person's own tasks. They can
// change status and dates and post in the conversation — nothing else.
export function GuestTasksBoard({ token }: { token: string }) {
  const { t, dateLocale } = useLocale();
  const base = `/api/guest/${token}`;
  const [data, setData] = useState<{ member: { name: string }; project: { name: string; domain: string } } | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [invalid, setInvalid] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datesOpenFor, setDatesOpenFor] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetch(base)
      .then(async (r) => {
        if (!r.ok) return setInvalid(true);
        const d = await r.json();
        setData({ member: d.member, project: d.project });
        setTasks(d.tasks);
      })
      .catch(() => setInvalid(true))
      .finally(() => setLoading(false));
  }, [base]);

  async function patchTask(id: string, patch: Record<string, unknown>) {
    const before = tasks;
    setError(null);
    setTasks((prev) => prev.map((x) => (x.id === id ? ({ ...x, ...patch } as Task) : x)));
    try {
      const res = await fetch(`${base}/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || t("tasks.error"));
      setTasks((prev) => prev.map((x) => (x.id === id ? json.task : x)));
    } catch (err) {
      setTasks(before);
      setError(err instanceof Error ? err.message : t("tasks.error"));
    }
  }

  if (loading) return <p className="text-sm text-neutral-400">…</p>;
  if (invalid || !data) {
    return <p className="text-sm text-neutral-600 bg-white border border-neutral-200 rounded-xl px-4 py-6">{t("tasks.guest.invalid")}</p>;
  }

  const selected = tasks.find((x) => x.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-lg font-semibold text-neutral-900">{t("tasks.guest.hello", { name: data.member.name })}</p>
        <p className="text-sm text-neutral-500 mt-0.5">{t("tasks.guest.subtitle", { project: data.project.name })}</p>
      </div>
      {error && <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-x-auto">
        <div className="min-w-[780px]">
          <div className={`${GRID} text-[13px] text-neutral-500 border-b border-neutral-200 bg-neutral-50`}>
            <span />
            <span className="px-3 py-2">{t("tasks.col.task")}</span>
            <span />
            <span className="px-3 py-2 text-center">{t("tasks.col.owner")}</span>
            <span className="px-3 py-2 text-center">{t("tasks.col.status")}</span>
            <span className="px-3 py-2 text-center">{t("tasks.col.timeline")}</span>
          </div>
          {tasks.length === 0 ? (
            <p className="text-xs text-neutral-400 px-3 py-4">{t("tasks.guest.empty")}</p>
          ) : (
            tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                guest
                members={[{ id: task.ownerId ?? "", name: data.member.name, email: "" }]}
                dateLocale={dateLocale}
                datesOpen={datesOpenFor === task.id}
                onToggleDates={() => setDatesOpenFor(datesOpenFor === task.id ? null : task.id)}
                onPatch={(patch) => patchTask(task.id, patch)}
                onOpen={() => setSelectedId(task.id)}
              />
            ))
          )}
        </div>
      </div>
      {selected && (
        <TaskDrawer
          key={selected.id}
          task={selected}
          ownerName={data.member.name}
          commentsUrl={`${base}/tasks/${selected.id}/comments`}
          onClose={() => setSelectedId(null)}
          onCommentAdded={() =>
            setTasks((prev) => prev.map((x) => (x.id === selected.id ? { ...x, commentCount: x.commentCount + 1 } : x)))
          }
        />
      )}
    </div>
  );
}
