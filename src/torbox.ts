import { TorboxClient } from "node-torbox-api";
import { config, requireEnv } from "./config";

let client: TorboxClient | null = null as any;

function getClient(): TorboxClient {
  requireEnv("torboxApiKey");
  if (!client) {
    client = new TorboxClient({ apiKey: config.torboxApiKey, baseURL: config.torboxBaseUrl });
  }
  return client;
}

export async function addMagnetToTorbox(magnet: string, name?: string) {
  const c = getClient();
  return c.torrents.createTorrent({ magnet, name });
}
