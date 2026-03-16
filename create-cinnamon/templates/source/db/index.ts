import { drizzle } from "drizzle-orm/node-postgres";

import { pool } from "./connection.ts";
import * as schema from "./schema/index.ts";

export const db = drizzle(pool, { schema });
export { pool };
