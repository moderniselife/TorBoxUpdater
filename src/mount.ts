import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync, spawn } from "child_process";
import { config, providersSet } from "./config";

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function obscurePassword(password: string): string {
  if (!password) return "";
  try {
    const res = spawnSync(config.rclonePath, ["obscure", password], { encoding: "utf8" });
    if (res.status === 0 && res.stdout) return res.stdout.trim();
  } catch {}
  return password;
}

function buildRcloneConfigFile(): string {
  const lines: string[] = [];
  const ps = providersSet();

  if (ps.has("realdebrid") && config.rdWebdavUrl && config.rdWebdavUsername && config.rdWebdavPassword) {
    lines.push(`[rd]`);
    lines.push(`type = webdav`);
    lines.push(`url = ${config.rdWebdavUrl}`);
    lines.push(`vendor = other`);
    lines.push(`user = ${config.rdWebdavUsername}`);
    lines.push(`pass = ${obscurePassword(config.rdWebdavPassword)}`);
    lines.push("");
  }

  if (ps.has("torbox") && config.torboxWebdavUrl && config.torboxWebdavUsername && config.torboxWebdavPassword) {
    lines.push(`[torbox]`);
    lines.push(`type = webdav`);
    lines.push(`url = ${config.torboxWebdavUrl}`);
    lines.push(`vendor = other`);
    lines.push(`user = ${config.torboxWebdavUsername}`);
    lines.push(`pass = ${obscurePassword(config.torboxWebdavPassword)}`);
    lines.push("");
  }

  if (!lines.length) {
    throw new Error("No WebDAV providers configured. Set RD_WEBDAV_* or TORBOX_WEBDAV_* envs and PROVIDERS.");
  }

  const dir = path.join(os.tmpdir(), "schrodrive");
  ensureDir(dir);
  const cfg = path.join(dir, "rclone.conf");
  fs.writeFileSync(cfg, lines.join("\n"), "utf8");
  return cfg;
}

function splitArgs(opts: string): string[] {
  const s = (opts || "").trim();
  if (!s) return [];
  return s.split(/\s+/);
}

export async function mountVirtualDrive(): Promise<void> {
  const cfg = buildRcloneConfigFile();
  const base = config.mountBase;
  ensureDir(base);

  const mounts: Array<{ remote: string; path: string }> = [];
  const ps = providersSet();
  if (ps.has("realdebrid") && config.rdWebdavUsername) mounts.push({ remote: "rd:", path: path.join(base, "realdebrid") });
  if (ps.has("torbox") && config.torboxWebdavUsername) mounts.push({ remote: "torbox:", path: path.join(base, "torbox") });

  if (!mounts.length) throw new Error("Nothing to mount. Check PROVIDERS and credentials.");

  for (const m of mounts) {
    ensureDir(m.path);
    // Build args - use either individual options OR MOUNT_OPTIONS, not both
    const args = [
      "mount",
      m.remote,
      m.path,
      "--config",
      cfg,
      "--allow-other",  // Allow other users to access the mount
      "--allow-non-empty",  // Allow mounting over non-empty directory
    ];
    
    // If custom MOUNT_OPTIONS are provided, use those; otherwise use individual settings
    if (config.mountOptions && config.mountOptions.trim()) {
      args.push(...splitArgs(config.mountOptions));
    } else {
      // Use individual environment variables
      args.push(`--poll-interval=${config.mountPollInterval}`);
      args.push(`--dir-cache-time=${config.mountDirCacheTime}`);
      args.push(`--vfs-cache-mode=${config.mountVfsCacheMode}`);
      args.push(`--buffer-size=${config.mountBufferSize}`);
      if ((config.mountVfsReadChunkSize || "").trim()) args.push(`--vfs-read-chunk-size=${config.mountVfsReadChunkSize}`);
      if ((config.mountVfsReadChunkSizeLimit || "").trim()) args.push(`--vfs-read-chunk-size-limit=${config.mountVfsReadChunkSizeLimit}`);
      if ((config.mountVfsCacheMaxAge || "").trim()) args.push(`--vfs-cache-max-age=${config.mountVfsCacheMaxAge}`);
      if ((config.mountVfsCacheMaxSize || "").trim()) args.push(`--vfs-cache-max-size=${config.mountVfsCacheMaxSize}`);
    }
    
    // Don't daemonize so we can see errors
    console.log(`[${new Date().toISOString()}][mount] rclone ${args.join(" ")}`);
    
    // Test mount first (non-daemon) to see connection issues
    const testArgs = [...args, "--verbose", "--log-level=DEBUG"];
    const testProcess = spawn(config.rclonePath, testArgs, { stdio: "pipe", timeout: 10000 });
    
    let output = "";
    let errorOutput = "";
    testProcess.stdout?.on("data", (data) => output += data.toString());
    testProcess.stderr?.on("data", (data) => errorOutput += data.toString());
    
    testProcess.on("close", (code) => {
      if (code !== 0) {
        console.error(`[${new Date().toISOString()}][mount] Test mount failed for ${m.remote}:`, errorOutput);
      } else {
        // If test passes, start daemon mount
        const daemonArgs = [...args, "--daemon"];
        const p = spawn(config.rclonePath, daemonArgs, { stdio: "inherit" });
        p.on("error", (e) => {
          console.error(`[${new Date().toISOString()}][mount] failed`, { remote: m.remote, err: (e as any)?.message });
        });
        p.on("close", (code) => {
          if (code !== 0) {
            console.error(`[${new Date().toISOString()}][mount] daemon exited with code ${code} for ${m.remote}`);
          }
        });
      }
    });
  }

  console.log(`[${new Date().toISOString()}][mount] mounts initiated at ${base}`);
}
