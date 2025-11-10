import express from "express";
import { config, requireEnv } from "./config";
import { searchProwlarr, pickBestResult, getMagnet } from "./prowlarr";
import { addMagnetToTorbox } from "./torbox";

export function startServer() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/webhook/overseerr", async (req, res) => {
    try {
      requireEnv("prowlarrUrl", "prowlarrApiKey", "torboxApiKey");
      if (config.overseerrAuth && req.get("authorization") !== config.overseerrAuth) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }

      const payload = req.body || {};
      const built = buildQueryFromPayload(payload);

      if (!built || !built.query) {
        return res.status(400).json({ ok: false, error: "No query could be derived from payload." });
      }

      const results = await searchProwlarr(built.query, { categories: built.categories });
      const best = pickBestResult(results);
      const magnet = getMagnet(best);

      if (!magnet) {
        return res.status(404).json({ ok: false, error: "No magnet found in search results.", query: built.query, best });
      }

      const added = await addMagnetToTorbox(magnet, best?.title);
      res.json({ ok: true, query: built.query, categories: built.categories, chosen: best, torbox: added });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  });

  app.listen(config.port, () => {
    console.log(`Server listening on port ${config.port}`);
  });
}

function buildQueryFromPayload(payload: any): { query: string; categories?: string[] } | undefined {
  const subject: string | undefined = payload?.subject;
  const media = payload?.media || {};
  const title = media?.title || media?.name;
  const year = media?.year || media?.releaseYear;
  const mediaType = media?.media_type; // 'movie' or 'tv'
  const tmdbId = media?.tmdbId;

  let query = "";
  if (subject && subject.trim().length > 0) {
    query = subject.trim();
  } else if (title) {
    query = year ? `${title} ${year}` : title;
    if (tmdbId && Number.isInteger(Number(tmdbId))) {
      query += ` TMDB${tmdbId}`;
    }
  }

  if (!query) return undefined;

  const result: { query: string; categories?: string[] } = { query };

  // Map media_type to Prowlarr categories if configured
  const defaultCategories = {
    movie: ["5000"], // Movies
    tv: ["5000"], // TV (adjust as needed)
  };
  if (mediaType && defaultCategories[mediaType as keyof typeof defaultCategories]) {
    result.categories = defaultCategories[mediaType as keyof typeof defaultCategories];
  }

  return result;
}
