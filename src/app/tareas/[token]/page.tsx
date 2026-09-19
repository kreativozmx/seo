import { GuestTasksBoard } from "@/components/dashboard/TasksSection";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mis tareas — Shopify Audit", robots: { index: false, follow: false } };

// Personal guest link for invited (external) people: no login, just this
// secret URL. Shows only the tasks assigned to them.
export default function GuestTasksPage({ params }: { params: { token: string } }) {
  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <GuestTasksBoard token={params.token} />
    </main>
  );
}
