"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startOverseerrPoller = startOverseerrPoller;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("./config");
const prowlarr_1 = require("./prowlarr");
const torbox_1 = require("./torbox");
function buildSearchFromRequest(r) {
    const media = r?.media || {};
    const title = media.title || media.name;
    const year = media.year || media.releaseYear;
    const mediaType = media.mediaType || media.type;
    const tmdbId = media.tmdbId || r.mediaId;
    let query = "";
    if (title) {
        query = year ? `${title} ${year}` : String(title);
        if (tmdbId && Number.isInteger(Number(tmdbId))) {
            query += ` TMDB${tmdbId}`;
        }
    }
    if (!query)
        return undefined;
    const result = { query };
    const defaultCategories = {
        movie: ["5000"],
        tv: ["5000"],
    };
    const key = (mediaType || "").toString().toLowerCase();
    if (key && defaultCategories[key]) {
        result.categories = defaultCategories[key];
    }
    return result;
}
async function fetchApprovedRequests() {
    const base = config_1.config.overseerrUrl.replace(/\/$/, "");
    const url = `${base}/request`;
    const res = await axios_1.default.get(url, {
        params: { filter: "approved", sort: "modified", take: 50, skip: 0 },
        headers: { "X-Api-Key": config_1.config.overseerrApiKey },
        timeout: 30000,
    });
    const results = res?.data?.results || [];
    return Array.isArray(results) ? results : [];
}
function startOverseerrPoller() {
    (0, config_1.requireEnv)("prowlarrUrl", "prowlarrApiKey", "torboxApiKey");
    (0, config_1.requireEnv)("overseerrUrl", "overseerrApiKey");
    const processed = new Set();
    const intervalMs = Math.max(5, Number(config_1.config.pollIntervalSeconds || 30)) * 1000;
    const runOnce = async () => {
        try {
            const items = await fetchApprovedRequests();
            for (const r of items) {
                const id = String(r?.id ?? `${r?.mediaId ?? ""}:${r?.is4k ? "4k" : "hd"}`);
                if (!id)
                    continue;
                if (processed.has(id))
                    continue;
                const built = buildSearchFromRequest(r);
                if (!built) {
                    continue;
                }
                try {
                    const results = await (0, prowlarr_1.searchProwlarr)(built.query, { categories: built.categories });
                    const best = (0, prowlarr_1.pickBestResult)(results);
                    const magnet = (0, prowlarr_1.getMagnet)(best);
                    if (!magnet) {
                        console.warn("Poller: no magnet found", { query: built.query, id, best });
                        processed.add(id);
                        continue;
                    }
                    await (0, torbox_1.addMagnetToTorbox)(magnet, best?.title);
                    console.log("Poller: added to TorBox", { query: built.query, id, title: best?.title });
                    processed.add(id);
                    if (processed.size > 1000) {
                        // Trim processed set
                        const first = processed.values().next().value;
                        if (typeof first === "string") {
                            processed.delete(first);
                        }
                    }
                }
                catch (err) {
                    console.error("Poller: processing error", err?.message || String(err));
                }
            }
        }
        catch (e) {
            console.error("Poller: fetch error", e?.message || String(e));
        }
    };
    // Start immediately and then on interval
    runOnce();
    setInterval(runOnce, intervalMs);
    console.log(`Overseerr poller started (every ${Math.round(intervalMs / 1000)}s)`);
}
