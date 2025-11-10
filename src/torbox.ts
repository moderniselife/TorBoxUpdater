import { TorboxClient } from "node-torbox-api";
import { config, requireEnv } from "./config";

let client: TorboxClient | null = null as any;

function getClient(): TorboxClient {
  requireEnv("torboxApiKey");
  if (!client) {
    const maskedKey = config.torboxApiKey ? `${config.torboxApiKey.slice(0, 4)}…` : "unset";
    console.log(`[${new Date().toISOString()}][torbox] init client`, { baseURL: config.torboxBaseUrl, apiKey: maskedKey });
    client = new TorboxClient({ apiKey: config.torboxApiKey, baseURL: config.torboxBaseUrl });
  }
  return client;
}

export async function addMagnetToTorbox(magnet: string, name?: string) {
  const c = getClient();
  const teaser = magnet.slice(0, 80) + '...';
  console.log(`[${new Date().toISOString()}][torbox] createTorrent`, { name, teaser });
  const started = Date.now();
  const res = await c.torrents.createTorrent({ magnet, name });
  console.log(`[${new Date().toISOString()}][torbox] createTorrent done`, { ms: Date.now() - started });
  return res;
}
