import { Pool } from "pg";
import { getEnv } from "@/config/env.ts";

export const pool = new Pool({ connectionString: getEnv().databaseUrl });
