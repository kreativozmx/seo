"use client";

import { useContext, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import {
  CanAddTasksContext,
  NewTask,
  addTasksToProject,
  normalizeTitle,
  useTaskTitles,
} from "@/lib/tasksClient";

// "Agregar a Tareas" building blocks, reused across tabs:
//  - <AddToTasksButton>  one item, one click
//  - useTaskPicker + <PickerToolbar> + <PickBox>  choose several with
//    checkboxes and add them all at once
// Items already in the project's task list show "En Tareas ✓" instead.

export function useTaskPicker() {
  const [mode, setMode] = useState(false);
  const [selected, setSelected] = useState<Map<string, NewTask>>(new Map());
  return {
    mode,
    selected,
    startMode: () => setMode(true),
    stopMode: () => {
      setMode(false);
      setSelected(new Map());
    },
    toggle: (task: NewTask) =>
      setSelected((prev) => {
        const next = new Map(prev);
        if (next.has(task.key)) next.delete(task.key);
        else next.set(task.key, task);
        return next;
      }),
    setAll: (tasks: NewTask[]) => setSelected(new Map(tasks.map((t) => [t.key, t]))),
    clear: () => setSelected(new Map()),
  };
}
export type TaskPicker = ReturnType<typeof useTaskPicker>;

export function AddToTasksButton({ projectId, task }: { projectId: string; task: NewTask }) {
  const { t } = useLocale();
  const canAdd = useContext(CanAddTasksContext);
  const titles = useTaskTitles(projectId);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!canAdd) return null;

  const inTasks = titles.has(normalizeTitle(task.title));
  if (inTasks) {
    return <span className="text-[12px] text-[#155D34] whitespace-nowrap shrink-0">{t("addtask.added")}</span>;
  }
  return (
    <button
      type="button"
      title={failed ? t("addtask.error") : t("addtask.tooltip")}
      disabled={busy}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setBusy(true);
        setFailed(false);
        try {
          await addTasksToProject(projectId, [task]);
        } catch {
          setFailed(true);
        } finally {
          setBusy(false);
        }
      }}
      className={`text-[12px] font-medium rounded-md px-2 py-0.5 border transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 ${
        failed
          ? "border-red-200 text-red-600"
          : "border-neutral-200 text-neutral-600 hover:border-[#228449] hover:text-[#228449] bg-white"
      }`}
    >
      {busy ? t("addtask.adding") : t("addtask.button")}
    </button>
  );
}

// Selection checkbox for a row; only visible while the list is in pick mode.
export function PickBox({ projectId, picker, task }: { projectId: string; picker: TaskPicker; task: NewTask }) {
  const canAdd = useContext(CanAddTasksContext);
  const titles = useTaskTitles(projectId);
  if (!canAdd || !picker.mode) return null;
  const inTasks = titles.has(normalizeTitle(task.title));
  return (
    <input
      type="checkbox"
      checked={inTasks || picker.selected.has(task.key)}
      disabled={inTasks}
      onChange={() => picker.toggle(task)}
      onClick={(e) => e.stopPropagation()}
      aria-label={task.title}
      className="w-4 h-4 accent-[#228449] cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-default"
    />
  );
}

// Header controls for a list: "Elegir varias" -> select all / count / add.
export function PickerToolbar({
  projectId,
  picker,
  items,
}: {
  projectId: string;
  picker: TaskPicker;
  items: NewTask[]; // every item the user could add (already-added ones are filtered out here)
}) {
  const { t } = useLocale();
  const canAdd = useContext(CanAddTasksContext);
  const titles = useTaskTitles(projectId);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  if (!canAdd || items.length === 0) return null;

  const addable = items.filter((i) => !titles.has(normalizeTitle(i.title)));
  const count = picker.selected.size;

  async function addSelected() {
    setBusy(true);
    try {
      const { created, skipped } = await addTasksToProject(projectId, Array.from(picker.selected.values()));
      setMessage({
        text: skipped > 0 ? t("addtask.resultSkipped", { created, skipped }) : t("addtask.result", { created }),
        error: false,
      });
      picker.stopMode();
    } catch {
      setMessage({ text: t("addtask.error"), error: true });
    } finally {
      setBusy(false);
      setTimeout(() => setMessage(null), 5000);
    }
  }

  if (!picker.mode) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          disabled={addable.length === 0}
          onClick={picker.startMode}
          className="text-xs bg-white border border-neutral-200 hover:border-neutral-300 disabled:opacity-40 text-neutral-700 font-medium rounded-md px-3 py-1.5 transition-colors whitespace-nowrap"
        >
          {t("addtask.pickMode")}
        </button>
        {message && (
          <span className={`text-xs ${message.error ? "text-red-600" : "text-[#155D34]"}`}>{message.text}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap bg-[#E6F4EC] border border-[#228449]/20 rounded-lg px-3 py-1.5">
      <button
        type="button"
        onClick={() => (count === addable.length ? picker.clear() : picker.setAll(addable))}
        className="text-xs text-[#155D34] hover:underline underline-offset-2"
      >
        {count === addable.length && count > 0 ? t("addtask.selectNone") : t("addtask.selectAll")}
      </button>
      <span className="text-xs text-neutral-500">{t("addtask.selected", { count })}</span>
      <button
        type="button"
        disabled={count === 0 || busy}
        onClick={addSelected}
        className="text-xs bg-[#228449] hover:bg-[#1B6B3A] disabled:opacity-50 text-white font-medium rounded-md px-3 py-1 transition-colors whitespace-nowrap"
      >
        {busy ? t("addtask.adding") : t("addtask.addSelected", { count })}
      </button>
      <button type="button" onClick={picker.stopMode} className="text-xs text-neutral-500 hover:text-neutral-800 transition-colors">
        {t("addtask.cancel")}
      </button>
    </div>
  );
}
