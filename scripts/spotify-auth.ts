/**
 * One-time Spotify OAuth script.
 *
 * Opens the browser for authorization, catches the callback on a local server,
 * exchanges the code for tokens, and writes SPOTIFY_REFRESH_TOKEN to .env.
 *
 * Usage: bun run auth:spotify
 */

import { exec } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const PORT = 8888;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;
const SCOPES = [
  // Listening history
  "user-read-recently-played",
  "user-read-playback-position",
  "user-top-read",

  // Library
  "user-library-read",

  // Playback state
  "user-read-playback-state",
  "user-read-currently-playing",

  // Playlists
  "playlist-read-private",
  "playlist-read-collaborative",

  // Follow
  "user-follow-read",

  // Profile
  "user-read-private",
  "user-read-email",
].join(" ");

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(rootDir, ".env");

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is required in .env to run this script.`);
    process.exit(1);
  }
  return value;
}

function openBrowser(url: string) {
  const cmd =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  exec(`${cmd} "${url}"`);
}

async function exchangeCodeForTokens(code: string, clientId: string, clientSecret: string) {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
  });

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${body}`);
  }

  return (await response.json()) as { access_token: string; refresh_token: string };
}

async function updateEnvFile(refreshToken: string) {
  let contents: string;
  try {
    contents = await readFile(envPath, "utf8");
  } catch {
    contents = "";
  }

  const hasKey = /^SPOTIFY_REFRESH_TOKEN=/m.test(contents);

  if (hasKey) {
    contents = contents.replace(
      /^SPOTIFY_REFRESH_TOKEN=.*$/m,
      `SPOTIFY_REFRESH_TOKEN=${refreshToken}`,
    );
  } else {
    contents = `${contents.trimEnd()}\nSPOTIFY_REFRESH_TOKEN=${refreshToken}\n`;
  }

  await writeFile(envPath, contents, "utf8");
}

async function main() {
  const clientId = requireEnv("SPOTIFY_CLIENT_ID");
  const clientSecret = requireEnv("SPOTIFY_CLIENT_SECRET");

  const authUrl = new URL("https://accounts.spotify.com/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("scope", SCOPES);

  console.log(`\nOpening browser for Spotify authorization...\n`);
  console.log(`If it doesn't open, visit:\n${authUrl.toString()}\n`);
  openBrowser(authUrl.toString());

  return new Promise<void>((resolve) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);

      if (url.pathname !== "/callback") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const error = url.searchParams.get("error");
      if (error) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<h1>Authorization denied</h1><p>${error}</p>`);
        console.error(`Authorization denied: ${error}`);
        server.close();
        process.exit(1);
      }

      const code = url.searchParams.get("code");
      if (!code) {
        res.writeHead(400);
        res.end("Missing code parameter");
        return;
      }

      try {
        const tokens = await exchangeCodeForTokens(code, clientId, clientSecret);
        await updateEnvFile(tokens.refresh_token);

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h1>Done!</h1><p>Refresh token saved to .env. You can close this tab.</p>");

        console.log("Refresh token saved to .env");
        console.log(`Scopes authorized: ${SCOPES}`);
        console.log("\nYou can now run Spotify jobs:");
        console.log("  bun run trigger spotify-recently-played '{\"dryRun\":true}'");
        console.log("  bun run trigger spotify-top-tracks '{\"dryRun\":true}'");
      } catch (err) {
        res.writeHead(500, { "Content-Type": "text/html" });
        res.end(`<h1>Error</h1><p>${err}</p>`);
        console.error("Token exchange failed:", err);
      }

      server.close();
      resolve();
    });

    server.listen(PORT, "127.0.0.1", () => {
      console.log(`Waiting for callback on ${REDIRECT_URI} ...`);
    });
  });
}

main().catch((error) => {
  console.error("Spotify auth failed:", error);
  process.exit(1);
});
