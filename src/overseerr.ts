import axios from "axios";
import { config, requireEnv } from "./config";
import { searchProwlarr, pickBestResult, getMagnet } from "./prowlarr";
import { addMagnetToTorbox } from "./torbox";

interface MediaLike {
  title?: string;
  name?: string;
  year?: number;
  releaseYear?: number;
  mediaType?: string;
  type?: string;
  tmdbId?: number | string;
}

interface MediaRequestLike {
  id?: number;
  mediaId?: number;
  createdAt?: string;
  updatedAt?: string;
  status?: string;
  is4k?: boolean;
  media?: MediaLike;
}

function buildSearchFromRequest(r: MediaRequestLike): { query: string; categories?: string[] } | undefined {
  const media = r?.media || {};
  const title = media.title || media.name;
  const year = (media.year as any) || (media.releaseYear as any);
  const mediaType = (media.mediaType as any) || (media.type as any);
  const tmdbId = (media.tmdbId as any) || (r.mediaId as any);

  let query = "";
  if (title) {
    query = year ? `${title} ${year}` : String(title);
    if (tmdbId && Number.isInteger(Number(tmdbId))) {
      query += ` TMDB${tmdbId}`;
    }
  }

  if (!query) return undefined;

  const result: { query: string; categories?: string[] } = { query };
  const defaultCategories: Record<string, string[]> = {
    movie: ["5000"],
    tv: ["5000"],
  };
  const key = (mediaType || "").toString().toLowerCase() as keyof typeof defaultCategories;
  if (key && defaultCategories[key]) {
    result.categories = defaultCategories[key];
  }
  return result;
}

async function fetchApprovedRequests(): Promise<MediaRequestLike[]> {
  const base = config.overseerrUrl.replace(/\/$/, "");
  const url = `${base}/request`;
  const started = Date.now();
  console.log(`[${new Date().toISOString()}][poller->overseerr] GET ${url}`, {
    params: { filter: "approved", sort: "modified", take: 50, skip: 0 },
  });
  const res = await axios.get(url, {
    params: { filter: "approved", sort: "modified", take: 50, skip: 0 },
    headers: { "X-Api-Key": config.overseerrApiKey },
    timeout: 30000,
  });
  const results = res?.data?.results || [];
  console.log(`[${new Date().toISOString()}][poller->overseerr] response`, { count: Array.isArray(results) ? results.length : 0, ms: Date.now() - started });
  return Array.isArray(results) ? results : [];
}

export function startOverseerrPoller() {
  requireEnv("prowlarrUrl", "prowlarrApiKey", "torboxApiKey");
  requireEnv("overseerrUrl", "overseerrApiKey");

  const processed = new Set<string>();
  const intervalMs = Math.max(5, Number(config.pollIntervalSeconds || 30)) * 1000;
  console.log(`[${new Date().toISOString()}][poller] starting`, { intervalSeconds: Math.round(intervalMs / 1000) });

  const runOnce = async () => {
    try {
      console.log(`[${new Date().toISOString()}][poller] tick`);
      const items = await fetchApprovedRequests();
      console.log(`[${new Date().toISOString()}][poller] approved requests fetched`, { count: items.length });
      for (const r of items) {
        const id = String(r?.id ?? `${r?.mediaId ?? ""}:${r?.is4k ? "4k" : "hd"}`);
        if (!id) continue;
        if (processed.has(id)) {
          console.log(`[${new Date().toISOString()}][poller] skip already processed`, { id });
          continue;
        }

        const built = buildSearchFromRequest(r);
        if (!built) {
          console.warn(`[${new Date().toISOString()}][poller] could not build query from request`, { id, media: r?.media });
          continue;
        }

        try {
          console.log(`[${new Date().toISOString()}][poller->prowlarr] searching`, { id, query: built.query, categories: built.categories });
          const t0 = Date.now();
          const results = await searchProwlarr(built.query, { categories: built.categories });
          console.log(`[${new Date().toISOString()}][poller->prowlarr] results`, { id, count: results.length, ms: Date.now() - t0 });
          const best = pickBestResult(results);
          console.log(`[${new Date().toISOString()}][poller->prowlarr] chosen`, { id, title: (best as any)?.title, seeders: (best as any)?.seeders, size: (best as any)?.size });
          const magnet = getMagnet(best);
          if (!magnet) {
            console.warn(`[${new Date().toISOString()}][poller] no magnet found`, { id, query: built.query });
            processed.add(id);
            continue;
          }
          const teaser = magnet.slice(0, 80) + '...';
          console.log(`[${new Date().toISOString()}][poller->torbox] adding magnet`, { id, title: (best as any)?.title, teaser });
          await addMagnetToTorbox(magnet, (best as any)?.title);
          console.log(`[${new Date().toISOString()}][poller->torbox] added`, { id });
          processed.add(id);
          if (processed.size > 1000) {
            // Trim processed set
            const first = processed.values().next().value as string | undefined;
            if (typeof first === "string") {
              processed.delete(first);
            }
          }
        } catch (err: any) {
          console.error(`[${new Date().toISOString()}][poller] processing error`, err?.message || String(err));
        }
      }
    } catch (e: any) {
      console.error(`[${new Date().toISOString()}][poller] fetch error`, e?.message || String(e));
    }
  };

  // Start immediately and then on interval
  runOnce();
  setInterval(runOnce, intervalMs);
  console.log(`[${new Date().toISOString()}][poller] started`, { everySeconds: Math.round(intervalMs / 1000) });
}
