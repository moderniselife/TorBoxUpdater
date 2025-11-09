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
      const query = buildQueryFromPayload(payload);

      if (!query) {
        return res.status(400).json({ ok: false, error: "No query could be derived from payload." });
      }

      const results = await searchProwlarr(query);
      const best = pickBestResult(results);
      const magnet = getMagnet(best);

      if (!magnet) {
        return res.status(404).json({ ok: false, error: "No magnet found in search results.", query, best });
      }

      const added = await addMagnetToTorbox(magnet, best?.title);
      res.json({ ok: true, query, chosen: best, torbox: added });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  });

  app.listen(config.port, () => {
    console.log(`Server listening on port ${config.port}`);
  });
}

function buildQueryFromPayload(payload: any): string | undefined {
  const subject: string | undefined = payload?.subject;
  if (subject && subject.trim().length > 0) return subject.trim();

  const media = payload?.media || {};
  const title = media?.title || media?.name;
  const year = media?.year || media?.releaseYear;
  if (title) return year ? `${title} ${year}` : title;

  return undefined;
}
