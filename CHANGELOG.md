# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog (https://keepachangelog.com/en/1.0.0/),
and this project adheres to Semantic Versioning (https://semver.org/spec/v2.0.0.html).

### Version [0.1.20] - 2025-11-10 🚀

### Added ✨
- Prowlarr client tuning via environment:
  - `PROWLARR_TIMEOUT_MS` (default 45000, clamped 5s–120s)
  - `PROWLARR_INDEXER_IDS` (comma-separated IDs) to limit queried indexers
  - `PROWLARR_SEARCH_LIMIT` to cap results
- Query sanitation and fallbacks:
  - Strip `TMDB####` tokens from search queries before calling Prowlarr
  - Retry without the year when zero results are returned
  - Retry without categories when still zero results
- Send `type=search` to `/api/v1/search`
- Overseerr auth: support either `X-Api-Key` or `Authorization: Bearer <token>`

### Changed 🔄
- Improved request/diagnostic logging for Prowlarr (timeouts, params, fallbacks) and Overseerr
- Default Prowlarr client timeout increased to 45s (configurable)

### Fixed 🐛
- 401 Unauthorized on Prowlarr search by including `X-Api-Key` header in `/api/v1/search`
- 401 Unauthorized on Overseerr API calls by honoring configured `X-Api-Key` or `Authorization: Bearer` headers

---

### Earlier (summary) 📜
- Core features and tooling:
  - Overseerr webhook endpoint with background processing
  - Optional Overseerr API poller mode
  - Prowlarr search integration and best-result selection by seeders (fallback by size)
  - TorBox integration: add magnets, duplicate detection
  - CLI commands to search and add
  - Docker image and Compose
  - Auto-update support via GitHub Releases

