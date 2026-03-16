import path from "node:path";
import { fileURLToPath } from "node:url";

export function isDirectExecution(importMetaUrl: string): boolean {
  return (
    process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(importMetaUrl)
  );
}
