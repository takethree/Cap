import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";
import { migrateDomainSpace } from "./domain-space-migration.mjs";

const args = process.argv.slice(2);
if (args.length < 1 || args.length > 2 || (args[1] && args[1] !== "--apply")) {
	throw new Error(
		"Usage: node scripts/migrate-domain-space.mjs <private-config.json> [--apply]",
	);
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const options = JSON.parse(await readFile(args[0], "utf8"));
const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
	const plan = await migrateDomainSpace(connection, {
		...options,
		apply: args[1] === "--apply",
	});
	console.log(JSON.stringify(plan, null, 2));
} finally {
	await connection.end();
}
