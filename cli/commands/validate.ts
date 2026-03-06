import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { bold } from "../format.ts";

export async function validateCommand(args: string[]): Promise<void> {
  const configPath = resolve(args[0] ?? "cinnamon.config.ts");

  if (!existsSync(configPath)) {
    console.error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  try {
    const mod = await import(configPath);
    const raw = mod.default ?? mod;

    const { _validateConfig } = await import("@/config/load-config.ts");
    _validateConfig(raw);

    const jobCount = Object.keys(raw.jobs ?? {}).length;
    console.log(`${bold("✓")} Config is valid (${jobCount} job${jobCount === 1 ? "" : "s"})`);
  } catch (err) {
    console.error(`${bold("✗")} Validation failed:\n  ${(err as Error).message}`);
    process.exit(1);
  }
}
