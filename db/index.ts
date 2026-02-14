import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../config/env.ts";

import * as schema from "./schema/index.ts";

const pool = new Pool({ connectionString: env.databaseUrl });

export const db = drizzle(pool, { schema });
export { pool };
