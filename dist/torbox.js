"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addMagnetToTorbox = addMagnetToTorbox;
const node_torbox_api_1 = require("node-torbox-api");
const config_1 = require("./config");
let client = null;
function getClient() {
    (0, config_1.requireEnv)("torboxApiKey");
    if (!client) {
        client = new node_torbox_api_1.TorboxClient({ apiKey: config_1.config.torboxApiKey, baseURL: config_1.config.torboxBaseUrl });
    }
    return client;
}
async function addMagnetToTorbox(magnet, name) {
    const c = getClient();
    return c.torrents.createTorrent({ magnet, name });
}
