"use client";

import { createContext, useEffect, useSyncExternalStore } from "react";

// Client-side helpers for "Agregar a Tareas": one shared, reactive set of the
// project's existing task titles (so every button across every tab knows what
// is already in the list) plus the bulk-add call.

// false in the read-only client share view — the buttons render nothing there.
export const CanAddTasksContext = createContext(true);

export interface NewTask {
  key: string; // stable id within its list (for selection)
  title: string;
  note?: string; // context saved as the task's first conversation message
}

export const normalizeTitle = (t: string) => t.trim().toLowerCase();

// Shared with TasksSection so its list refreshes after a bulk add.
export const tasksListCache = new Map<string, { tasks: unknown[]; members: unknown[] }>();

const titleSets = new Map<string, Set<string>>();
const loadingIds = new Set<string>();
const listeners = new Set<() => void>();
const EMPTY = new Set<string>();

function emit() {
  listeners.forEach((l) => l());
}
function setTitles(projectId: string, titles: Set<string>) {
  titleSets.set(projectId, titles);
  emit();
}

async function loadTitles(projectId: string) {
  if (loadingIds.has(projectId) || titleSets.has(projectId)) return;
  loadingIds.add(projectId);
  try {
    const res = await fetch(`/api/projects/${projectId}/tasks`);
    const data = await res.json();
    setTitles(projectId, new Set((data.tasks ?? []).map((t: { title: string }) => normalizeTitle(t.title))));
  } catch {
    // leave unloaded: buttons just behave as "not added yet"
  } finally {
    loadingIds.delete(projectId);
  }
}

// Reactive set of normalized titles already in the project's task list.
export function useTaskTitles(projectId: string): Set<string> {
  useEffect(() => {
    loadTitles(projectId);
  }, [projectId]);
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => titleSets.get(projectId) ?? EMPTY,
    () => EMPTY
  );
}

export async function addTasksToProject(
  projectId: string,
  tasks: NewTask[]
): Promise<{ created: number; skipped: number }> {
  const res = await fetch(`/api/projects/${projectId}/tasks/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tasks: tasks.map((t) => ({ title: t.title, note: t.note })) }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error");
  const next = new Set(titleSets.get(projectId) ?? []);
  tasks.forEach((t) => next.add(normalizeTitle(t.title)));
  setTitles(projectId, next);
  tasksListCache.delete(projectId);
  return { created: data.created.length, skipped: data.skipped.length };
}
