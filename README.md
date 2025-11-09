# TorBox Updater

[![Release](https://img.shields.io/github/v/release/moderniselife/TorBoxUpdater)](https://github.com/moderniselife/TorBoxUpdater/releases)
[![Build Status](https://github.com/moderniselife/TorBoxUpdater/workflows/Build%20and%20Push%20to%20GHCR/badge.svg)](https://github.com/moderniselife/TorBoxUpdater/actions)
[![License](https://img.shields.io/github/license/moderniselife/TorBoxUpdater)](LICENSE)
[![Docker Pulls](https://img.shields.io/docker/pulls/ghcr.io/moderniselife/torboxupdater)](https://ghcr.io/moderniselife/torboxupdater)

CLI/Webhook service that listens to Overseerr requests, searches Prowlarr for a torrent, and adds the magnet to TorBox via node-torbox-api.

## Releases
- [Latest Release](https://github.com/moderniselife/TorBoxUpdater/releases/latest) - Auto-incremented version and release notes
- Docker image: `ghcr.io/moderniselife/torboxupdater:latest` and `ghcr.io/moderniselife/torboxupdater:vX.Y.Z`

## Features
- Webhook endpoint for Overseerr notifications
- Prowlarr search using `/api/v1/search`
- Picks best result by seeders (fallback by size)
- Adds magnet to TorBox
- CLI for manual search/add
- Docker image

## Requirements
- Node.js 18+
- Prowlarr URL and API key
- TorBox API key
- Optional secret for Overseerr webhook Authorization

## Environment Variables
- `PORT` (default `8080`)
- `PROWLARR_URL` (e.g. `http://localhost:9696`)
- `PROWLARR_API_KEY`
- `PROWLARR_CATEGORIES` (comma-separated category IDs, optional)
- `TORBOX_API_KEY`
- `TORBOX_BASE_URL` (default `https://api.torbox.app`)
- `OVERSEERR_AUTH` (optional Authorization value to require on webhook)

## Install & Build
```bash
npm ci
npm run build
```

## Run (Local)
```bash
PROWLARR_URL=http://localhost:9696 \
PROWLARR_API_KEY=xxxxx \
TORBOX_API_KEY=tb_xxxxx \
node dist/index.js serve
```

Health check:
```bash
curl http://localhost:8080/health
```

## Overseerr Webhook Setup
- Add a Webhook notification agent in Overseerr Settings -> Notifications
- Webhook URL: `http://<host>:8080/webhook/overseerr`
- Authorization Header (optional): set the value to your chosen secret and set `OVERSEERR_AUTH` to the same value in this service
- JSON Payload (example):
```json
{
  "notification_type": "{{notification_type}}",
  "event": "{{event}}",
  "subject": "{{subject}}",
  "message": "{{message}}",
  "media": {{media}},
  "request": {{request}}
}
```
- Recommended events: Request Approved (or as desired)

## CLI
Search Prowlarr and print the best result:
```bash
node dist/index.js search "Big Buck Bunny 2008"
```

Add a magnet directly to TorBox:
```bash
node dist/index.js add --magnet "magnet:?xt=urn:btih:..."
```

Search and add the best result automatically:
```bash
node dist/index.js add --query "Ubuntu 24.04"
```

## Docker Compose
1. Copy environment template:
```bash
cp .env.example .env
# Edit .env with your Prowlarr and TorBox credentials
```

2. Start services:
```bash
docker-compose up -d
```

3. Health check:
```bash
curl http://localhost:8080/health
```

The stack includes:
- `torbox-updater` on port 8080
- `prowlarr` on port 9696 (LinuxServer image)
- Shared `media` network
- Persistent `prowlarr_config` volume

## GitHub Actions
This repository includes two workflows:

- **build-push.yml**: Builds and pushes to GHCR for linux/amd64 (fast, default)
- **build-push-multi.yml**: Multi-platform build for linux/amd64 and linux/arm64 (slower)

Both trigger on pushes to `main`/`master` and manual dispatch.

Build locally and push manually:
```bash
docker build -t ghcr.io/moderniselife/torboxupdater:latest .
docker push ghcr.io/moderniselife/torboxupdater:latest
```

Pull and run:
```bash
docker run --rm -p 8080:8080 \
  -e PROWLARR_URL=http://prowlarr:9696 \
  -e PROWLARR_API_KEY=xxxxx \
  -e TORBOX_API_KEY=tb_xxxxx \
  -e OVERSEERR_AUTH=supersecret \
  ghcr.io/moderniselife/torboxupdater:latest
```

## Notes
- The webhook handler derives the search query from `subject` or `media.title/name` and `media.year/releaseYear`.
- Prowlarr categories can be constrained via `PROWLARR_CATEGORIES`.
