import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const CONFIG_DIR = join(homedir(), ".cinnamon");
export const CONFIG_PATH = join(CONFIG_DIR, "config.json");

export interface CliConfig {
  apiUrl: string;
  apiKey: string;
}

interface CliFlags {
  apiUrl?: string;
  apiKey?: string;
}

function loadConfigFile(): Partial<CliConfig> {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    return {
      apiUrl: typeof raw.api_url === "string" ? raw.api_url : undefined,
      apiKey: typeof raw.api_key === "string" ? raw.api_key : undefined,
    };
  } catch {
    return {};
  }
}

export function loadCliConfig(flags: CliFlags = {}): CliConfig {
  const file = loadConfigFile();

  const apiUrl = flags.apiUrl ?? process.env.CINNAMON_API_URL ?? file.apiUrl;
  const apiKey = flags.apiKey ?? process.env.CINNAMON_API_KEY ?? file.apiKey;

  if (!apiUrl) {
    console.error("Missing API URL. Set CINNAMON_API_URL, pass --api-url, or run `cinnamon init`.");
    process.exit(1);
  }
  if (!apiKey) {
    console.error("Missing API key. Set CINNAMON_API_KEY, pass --api-key, or run `cinnamon init`.");
    process.exit(1);
  }

  return { apiUrl: apiUrl.replace(/\/+$/, ""), apiKey };
}
