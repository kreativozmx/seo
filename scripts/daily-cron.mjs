// Standalone scheduler: pings the app's daily-check endpoint every day at
// a fixed time. Runs as a separate lightweight process (`npm run cron`) so
// it never touches Next.js's build pipeline — no edge-runtime bundling
// issues, no OS-level cron setup required.
import cron from "node-cron";

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const SCHEDULE = process.env.CRON_SCHEDULE || "0 6 * * *"; // 6:00 AM daily

async function runDailyCheck() {
  const startedAt = new Date().toISOString();
  console.log(`[daily-cron] ${startedAt} - running daily rank check...`);
  try {
    const headers = process.env.CRON_SECRET
      ? { Authorization: `Bearer ${process.env.CRON_SECRET}` }
      : undefined;
    const res = await fetch(`${APP_URL}/api/cron/run-daily`, { method: "POST", headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    console.log(
      `[daily-cron] done — keywords ok: ${data.keywordsOk}, failed: ${data.keywordsFailed}, GSC projects refreshed: ${data.gscProjectsOk}`
    );
  } catch (err) {
    console.error("[daily-cron] failed:", err.message || err);
  }
}

cron.schedule(SCHEDULE, runDailyCheck, { timezone: process.env.CRON_TZ });

console.log(
  `[daily-cron] scheduled "${SCHEDULE}" against ${APP_URL}. Keep this process running (e.g. \`npm run cron\`).`
);
