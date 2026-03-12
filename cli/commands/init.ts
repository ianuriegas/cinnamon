import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as readline from "node:readline/promises";
import { CONFIG_DIR, CONFIG_PATH } from "../config.ts";
import { bold, dim } from "../format.ts";

function maskKey(key: string): string {
  if (key.length <= 12) return "••••••••";
  return `${key.slice(0, 8)}...${key.slice(-4)}`;
}

function readSecret(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    stdout.write(prompt);

    if (!stdin.isTTY) {
      const rl = readline.createInterface({ input: stdin });
      rl.once("line", (line) => {
        rl.close();
        resolve(line);
      });
      return;
    }

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf-8");

    let input = "";
    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
    };

    function onData(chunk: string) {
      const cleaned = chunk.replace(/\x1b\[200~/g, "").replace(/\x1b\[201~/g, "");

      for (const ch of cleaned) {
        if (ch === "\n" || ch === "\r") {
          cleanup();
          stdout.write("\n");
          resolve(input);
          return;
        }
        if (ch === "\u0003") {
          cleanup();
          stdout.write("\n");
          reject(new Error("Aborted"));
          return;
        }
        if (ch === "\u007F" || ch === "\b") {
          if (input.length > 0) {
            input = input.slice(0, -1);
            stdout.write("\b \b");
          }
        } else if (ch.charCodeAt(0) >= 32) {
          input += ch;
          stdout.write("•");
        }
      }
    }

    stdin.on("data", onData);
  });
}

export async function initCommand(): Promise<void> {
  if (existsSync(CONFIG_PATH)) {
    const existing = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    console.log(`${bold("Existing config")} at ${CONFIG_PATH}:`);
    console.log(dim(`  api_url: ${existing.api_url ?? "—"}`));
    console.log(dim(`  api_key: ${existing.api_key ? maskKey(existing.api_key) : "—"}`));
    console.log();
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    const apiUrl =
      (await rl.question("API URL [http://localhost:3000]: ")) || "http://localhost:3000";
    rl.close();

    const apiKey = await readSecret("API Key: ");

    if (!apiKey) {
      console.error("API key is required.");
      process.exit(1);
    }

    mkdirSync(CONFIG_DIR, { recursive: true });
    const config = JSON.stringify({ api_url: apiUrl, api_key: apiKey }, null, 2);
    writeFileSync(CONFIG_PATH, `${config}\n`, { mode: 0o600 });

    console.log(`\n${bold("✓")} Config written to ${CONFIG_PATH}`);
  } catch (err) {
    if ((err as Error).message === "Aborted") {
      console.log("Cancelled.");
      process.exit(0);
    }
    throw err;
  }
}
