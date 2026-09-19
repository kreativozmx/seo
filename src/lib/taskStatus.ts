// Task statuses (monday-style colored cells). Labels are translated via i18n
// keys `tasks.status.<id>`.
export const TASK_STATUSES = [
  { id: "working", bg: "#fdab3d", fg: "#ffffff" },
  { id: "done", bg: "#00c875", fg: "#ffffff" },
  { id: "blocked", bg: "#df2f4a", fg: "#ffffff" },
  { id: "planned", bg: "#579bfc", fg: "#ffffff" },
  { id: "review", bg: "#037f4c", fg: "#ffffff" },
  { id: "waiting", bg: "#c4c4c4", fg: "#323338" },
  { id: "material", bg: "#a25ddc", fg: "#ffffff" },
] as const;

export type TaskStatusId = (typeof TASK_STATUSES)[number]["id"];

export function isTaskStatus(value: unknown): value is TaskStatusId {
  return TASK_STATUSES.some((s) => s.id === value);
}
