import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";
import { migrateDomainOrganization } from "./domain-organization-migration.mjs";

const args = process.argv.slice(2);
if (!args[0] || args.length > 2 || (args[1] && args[1] !== "--apply"))
	throw new Error(
		"Usage: node scripts/migrate-domain-organization.mjs <private-config.json> [--apply]",
	);
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const config = JSON.parse(await readFile(args[0], "utf8"));
const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
	console.log(
		JSON.stringify(
			await migrateDomainOrganization(connection, {
				...config,
				apply: args[1] === "--apply",
			}),
			null,
			2,
		),
	);
} finally {
	await connection.end();
}
