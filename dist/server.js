"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
exports.buildQueryFromPayload = buildQueryFromPayload;
const express_1 = __importDefault(require("express"));
const config_1 = require("./config");
const prowlarr_1 = require("./prowlarr");
const torbox_1 = require("./torbox");
const overseerr_1 = require("./overseerr");
function startServer() {
    const app = (0, express_1.default)();
    app.use(express_1.default.json({ limit: "1mb" }));
    app.get("/health", (_req, res) => {
        res.json({ ok: true });
    });
    if (config_1.config.runWebhook) {
        app.post("/webhook/overseerr", async (req, res) => {
            try {
                // Check required environment variables early and return a helpful error
                const missing = ["prowlarrUrl", "prowlarrApiKey", "torboxApiKey"].filter((key) => !String(config_1.config[key] || "").trim());
                if (missing.length) {
                    return res.status(503).json({
                        ok: false,
                        error: "Service not configured. Set the following environment variables:",
                        missing,
                        documentation: "See README.md for configuration instructions.",
                    });
                }
                if (config_1.config.overseerrAuth && req.get("authorization") !== config_1.config.overseerrAuth) {
                    return res.status(401).json({ ok: false, error: "Unauthorized" });
                }
                const payload = req.body || {};
                const built = buildQueryFromPayload(payload);
                if (!built || !built.query) {
                    return res.status(400).json({ ok: false, error: "No query could be derived from payload." });
                }
                // Respond immediately to avoid Overseerr's 20s timeout; process in background
                res.status(202).json({ ok: true, accepted: true, query: built.query, categories: built.categories });
                (async () => {
                    try {
                        const results = await (0, prowlarr_1.searchProwlarr)(built.query, { categories: built.categories });
                        const best = (0, prowlarr_1.pickBestResult)(results);
                        const magnet = (0, prowlarr_1.getMagnet)(best);
                        if (!magnet) {
                            console.warn("No magnet found in search results.", { query: built.query, best });
                            return;
                        }
                        await (0, torbox_1.addMagnetToTorbox)(magnet, best?.title);
                    }
                    catch (err) {
                        console.error("Async webhook processing error:", err?.message || String(err));
                    }
                })();
            }
            catch (e) {
                if (!res.headersSent) {
                    if (e?.code === 'ECONNABORTED' || e?.message?.includes('timeout')) {
                        res.status(504).json({ ok: false, error: "Request timed out while searching Prowlarr. Try again or check your indexer configuration." });
                    }
                    else {
                        res.status(500).json({ ok: false, error: e?.message || String(e) });
                    }
                }
            }
        });
    }
    app.listen(config_1.config.port, () => {
        console.log(`Server listening on port ${config_1.config.port}`);
    });
    // Optional: start Overseerr API poller
    if (config_1.config.runPoller) {
        (0, overseerr_1.startOverseerrPoller)();
    }
}
function buildQueryFromPayload(payload) {
    const subject = payload?.subject;
    const media = payload?.media || {};
    const title = media?.title || media?.name;
    const year = media?.year || media?.releaseYear;
    const mediaType = media?.media_type; // 'movie' or 'tv'
    const tmdbId = media?.tmdbId;
    let query = "";
    if (subject && subject.trim().length > 0) {
        query = subject.trim();
    }
    else if (title) {
        query = year ? `${title} ${year}` : title;
        if (tmdbId && Number.isInteger(Number(tmdbId))) {
            query += ` TMDB${tmdbId}`;
        }
    }
    if (!query)
        return undefined;
    const result = { query };
    // Map media_type to Prowlarr categories if configured
    const defaultCategories = {
        movie: ["5000"], // Movies
        tv: ["5000"], // TV (adjust as needed)
    };
    if (mediaType && defaultCategories[mediaType]) {
        result.categories = defaultCategories[mediaType];
    }
    return result;
}
