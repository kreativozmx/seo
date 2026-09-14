// DataForSEO App Data API — search Google Play and the Apple App Store by
// name/keyword. Unlike the SERP/Labs APIs, app search has no instant "live"
// endpoint: it's task-based (POST to create the task, then GET once it's
// ready), so we post the task and poll task_get a few times.
// Docs: https://docs.dataforseo.com/v3/app_data/

import { BASE_URL, authHeader } from "@/lib/providers/dataforseo";

export interface AppResult {
  appId: string;
  title: string;
  icon: string | null;
  developer: string | null;
  rating: number | null;
  reviewsCount: number | null;
  isFree: boolean | null;
  price: number | null;
  currency: string | null;
  url: string | null;
}

interface DataForSeoTask {
  status_code?: number;
  status_message?: string;
  result?: { items?: unknown[] }[];
}

async function pollTaskResult(
  postEndpoint: string,
  getEndpoint: string,
  body: Record<string, unknown>
): Promise<DataForSeoTask> {
  const postRes = await fetch(postEndpoint, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify([body]),
  });
  if (!postRes.ok) {
    const text = await postRes.text();
    throw new Error(`DataForSEO App Data request failed (${postRes.status}): ${text}`);
  }
  const postJson = await postRes.json();
  const postTask = postJson?.tasks?.[0];
  if (postTask?.status_code && postTask.status_code >= 40000) {
    throw new Error(
      `DataForSEO task error ${postTask.status_code}: ${postTask.status_message}`
    );
  }
  const taskId = postTask?.id;
  if (!taskId) throw new Error("DataForSEO no devolvio un id de tarea");

  const maxAttempts = 12;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 1500 : 2500));
    const getRes = await fetch(`${getEndpoint}/${taskId}`, {
      headers: { Authorization: authHeader() },
    });
    if (!getRes.ok) continue;
    const getJson = await getRes.json();
    const task = getJson?.tasks?.[0];
    if (task?.status_code === 20000 && task.result) {
      return task;
    }
  }
  throw new Error("La busqueda de apps tardo demasiado, intenta de nuevo en un momento.");
}

export async function searchGooglePlayApps(
  query: string,
  locationCode: string,
  languageCode: string,
  limit = 15
): Promise<AppResult[]> {
  const task = await pollTaskResult(
    `${BASE_URL}/app_data/google/app_searches/task_post`,
    `${BASE_URL}/app_data/google/app_searches/task_get/advanced`,
    {
      keyword: query,
      location_code: Number(locationCode),
      language_code: languageCode,
      depth: Math.max(30, Math.ceil(limit / 30) * 30),
    }
  );

  interface GoogleAppItem {
    app_id?: string;
    title?: string;
    icon?: string;
    developer?: string;
    url?: string;
    reviews_count?: number;
    is_free?: boolean;
    rating?: { value?: number };
    price?: { current?: number; currency?: string };
  }
  const items = (task?.result?.[0]?.items ?? []) as GoogleAppItem[];
  return items.slice(0, limit).map((item) => ({
    appId: item.app_id ?? "",
    title: item.title ?? "",
    icon: item.icon ?? null,
    developer: item.developer ?? null,
    rating: item.rating?.value ?? null,
    reviewsCount: item.reviews_count ?? null,
    isFree: item.is_free ?? null,
    price: item.price?.current ?? null,
    currency: item.price?.currency ?? null,
    url: item.url ?? null,
  }));
}

export async function searchAppleApps(
  query: string,
  locationCode: string,
  languageCode: string,
  limit = 15
): Promise<AppResult[]> {
  const task = await pollTaskResult(
    `${BASE_URL}/app_data/apple/app_searches/task_post`,
    `${BASE_URL}/app_data/apple/app_searches/task_get/advanced`,
    {
      keyword: query,
      location_code: Number(locationCode),
      language_code: languageCode,
      depth: Math.max(100, limit),
    }
  );

  interface AppleAppItem {
    app_id?: string;
    title?: string;
    icon?: string;
    url?: string;
    reviews_count?: number;
    is_free?: boolean;
    rating?: { value?: number; votes_count?: number };
    price?: { current?: number; currency?: string };
  }
  const items = (task?.result?.[0]?.items ?? []) as AppleAppItem[];
  return items.slice(0, limit).map((item) => ({
    appId: item.app_id ?? "",
    title: item.title ?? "",
    icon: item.icon ?? null,
    developer: null,
    rating: item.rating?.value ?? null,
    reviewsCount: item.reviews_count ?? item.rating?.votes_count ?? null,
    isFree: item.is_free ?? null,
    price: item.price?.current ?? null,
    currency: item.price?.currency ?? null,
    url: item.url ?? null,
  }));
}
