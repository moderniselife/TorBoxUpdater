"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchProwlarr = searchProwlarr;
exports.pickBestResult = pickBestResult;
exports.getMagnet = getMagnet;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("./config");
async function searchProwlarr(query, opts) {
    if (!config_1.config.prowlarrUrl || !config_1.config.prowlarrApiKey) {
        throw new Error("Prowlarr not configured. Set PROWLARR_URL and PROWLARR_API_KEY.");
    }
    const url = new URL("/api/v1/search", config_1.config.prowlarrUrl);
    const params = {
        query,
        apikey: config_1.config.prowlarrApiKey,
        type: "search",
    };
    const categories = (opts?.categories || config_1.config.prowlarrCategories);
    if (categories && categories.length) {
        params["categories"] = categories.join(",");
        params["cat"] = categories.join(","); // compatibility
    }
    if (opts?.indexerIds && opts.indexerIds.length) {
        params["indexerIds"] = opts.indexerIds.join(",");
    }
    if (opts?.limit && opts.limit > 0) {
        params["limit"] = String(opts.limit);
    }
    const res = await axios_1.default.get(url.toString(), {
        params,
        timeout: 45000, // Increased from 20s to 45s
    });
    return Array.isArray(res.data) ? res.data : [];
}
function pickBestResult(results) {
    const withMagnet = results.filter((r) => getMagnet(r));
    const pool = withMagnet.length ? withMagnet : results;
    return pool
        .slice()
        .sort((a, b) => (b.seeders || 0) - (a.seeders || 0) || (b.size || 0) - (a.size || 0))[0];
}
function getMagnet(r) {
    if (!r)
        return undefined;
    const magnet = r.magnetUrl || r.guid || r.link;
    if (typeof magnet === "string" && magnet.startsWith("magnet:"))
        return magnet;
    return undefined;
}
