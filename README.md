# Gamehub

Three tabletop games for friends: **Undertow**, **Wildgrove**, and **Midnight Market**. Play solo against bots or host an online table for 2–6 players. Guests follow your link, enter a name once, and return to their seat from the same browser.

## Local development

Requires Node.js 22.22+ (Node 24 recommended) and npm.

```sh
npm ci
npm run dev
```

Open http://localhost:3017. The **Start dev environment** Codex action runs the same command. It starts frontend hot reload and the backend together, uses `.data/gamehub.sqlite`, and stops both with Ctrl+C. An occupied port produces an error without stopping another process. Set `DEV_PORT` and `API_PORT` for alternative ports. If you create `.env`, set `PUBLIC_ORIGIN=http://localhost:3017` for development.

For other devices on your LAN, set `PUBLIC_ORIGIN` to your computer's LAN URL and use that exact URL on every device. Production should use HTTPS. Browser clipboard access may be unavailable on plain HTTP; copy the address-bar link instead.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

`preview` serves the complete application at http://localhost:4173. Local SQLite files, secrets, and generated assets are excluded from Git and Docker builds.

## Play together

1. Open **Play with friends** and sign up with your name, email, and a password of at least 10 characters.
2. Create a table and copy its invite link. Send the link yourself.
3. Guests enter a name; no account or email is required. Their session cookie identifies their seat, and browser local storage remembers their display name. Clearing browser data creates a new identity; reusing someone's name never claims their seat.
4. In the lobby, choose a game, total seats, and bot difficulty. Empty seats become bots when the host starts. Remove absent guests in the lobby if needed.
5. The host can return to the lobby for rematches or change games using the same invite. Closing the table permanently disables that link.

Seats are fixed during a match. Late arrivals wait for the next match and cannot inspect it. A disconnected player's turn waits for them; the host may replace a disconnected guest with a bot for that match. A replaced guest waits until the next match. If the host disconnects, other turns continue, but only the host can manage the table. There are no turn timers.

Solo matches and tutorials remain device-local and require no account. Online matches and accounts persist on the server. Online clients only receive their own hand and public information. All moves, dice, shuffling, and bots are authoritative on the server. Existing solo saves are not uploaded.

## Run on your server

The public image supports Linux AMD64 and ARM64:

```sh
docker pull ghcr.io/host-it-labs/gamehub:0.1.0
cp .env.example .env
# Edit PUBLIC_ORIGIN to your public HTTPS URL.
docker compose up -d
```

Use the included `compose.yaml`. The image includes the frontend, backend, and SQLite support; it needs no external database or email service. `GAMEHUB_PORT` is the client-facing port on your server and defaults to `8080`. Open `http://<server-address>:<GAMEHUB_PORT>` in a browser. The same application container handles `/api` internally on that origin, so there is no separate backend or database port to publish. The `gamehub-data` volume retains accounts, sessions, tables, and matches. The runtime is non-root (UID/GID 1000); a bind-mounted `/data` directory must be writable by that UID. Keep SQLite on a local disk and run one replica.

Compose publishes the client-facing port on all server interfaces by default. Set `PUBLIC_ORIGIN` to the exact URL people use, including its scheme and any non-standard port; for example, `http://192.0.2.10:8080` for direct LAN access or `https://games.example.com` behind a reverse proxy. Origin checks deliberately ignore forwarded headers. HTTPS enables Secure cookies.

Example nginx location inside your TLS virtual host:

```nginx
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_buffering off;
    proxy_read_timeout 75s;
}
```

SSE sends heartbeats every 15 seconds. Do not buffer or cache `/api/` responses. Health is available at `/api/health`. Logs go to container stdout/stderr; names, passwords, tokens, and game payloads are not deliberately logged. Authentication has per-account and per-connection-address rate limits; behind a shared proxy the address quota is shared.

### Backup, restore, and upgrades

Create a consistent SQLite backup while the service is running:

```sh
docker compose exec gamehub node --experimental-strip-types scripts/backup.ts /data/backup-2026-09-09.sqlite
docker compose cp gamehub:/data/backup-2026-09-09.sqlite ./backup-2026-09-09.sqlite
```

Use a new filename each time and store a protected copy outside the server. Backups include password hashes, session hashes, and private match state. The command never overwrites an existing backup.

Before upgrading, back up the volume, change the pinned image version in Compose, then run `docker compose pull && docker compose up -d`. Migrations run at startup; accounts and active matches survive container replacement. Never run `docker compose down -v` on a production installation.

To restore, stop the service, retain the current volume as recovery data, and populate a **new** volume with the backup as `gamehub.sqlite`, owned by UID/GID 1000. Point Compose at the new volume and start a compatible image version. Retain the old volume until you have verified login and restored matches. Do not copy only a live database file without its WAL; use the backup command instead. Older application versions refuse a newer database schema.

### Password recovery

There is no email verification or emailed password reset in v0.1.0. The server owner can reset a password through standard input without placing it in command arguments:

```sh
read -rs NEW_PASSWORD
printf '%s' "$NEW_PASSWORD" | docker compose exec -T gamehub node --experimental-strip-types scripts/reset-password.ts user@example.com
unset NEW_PASSWORD
```

This revokes the account's existing sessions. Guest seats cannot be recovered by name after their session cookie is lost; the host can remove the old seat in the lobby or replace it with a bot during play.

## Releases and validation

Pushes to `main` run typecheck, lint, rules/protocol tests, a production build, and a Docker persistence smoke test. Publishing a GitHub release reruns those checks and publishes `ghcr.io/host-it-labs/gamehub` with version, `latest` (stable releases), and `sha-<full commit>` tags. A release tag must match `v` plus the package version. The workflow uses GitHub's scoped package token; no registry password is stored in the repository.

Automated coverage includes complete seeded games, all player counts and viewer seats, mixed humans/bots, authentication, hidden information, stale/concurrent commands, SSE, and persisted recovery. Browser interaction, real phone gestures/audio, and your production reverse proxy require separate acceptance checks; protocol tests do not establish those results.

## License and assets

[PolyForm Noncommercial 1.0.0](LICENSE), matching Pomi. This is publicly available source with noncommercial terms. Third-party dependencies retain their licenses. See [asset provenance and originality](docs/ORIGINALITY.md).
