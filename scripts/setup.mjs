// Interactive setup: asks for the MongoDB Atlas username / password / cluster,
// checks the connection, then writes backed/.env.
//
//   npm run setup
//   npm run setup -- --username me --password secret --cluster cluster0.abc12.mongodb.net [--db name] [--force]
//
// Other flags: --out <path> (write somewhere else), --skip-check (don't test the connection)
import { createRequire } from "node:module";
import { existsSync, writeFileSync } from "node:fs";
import { Writable } from "node:stream";
import readline from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backend = path.join(root, "backed");
const requireBackend = createRequire(path.join(backend, "package.json"));

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith("--")) continue;
  const key = a.slice(2);
  const next = process.argv[i + 1];
  if (next === undefined || next.startsWith("--")) args[key] = true;
  else args[key] = process.argv[++i];
}

let config, mongoose;
try {
  config = requireBackend("./db-config.js");
  mongoose = requireBackend("mongoose");
} catch {
  console.error('Backend dependencies are missing. Run "npm install" first.');
  process.exit(1);
}

function ask(question, { hidden = false, fallback = "" } = {}) {
  return new Promise((resolve) => {
    let muted = false;
    const output = new Writable({
      write(chunk, enc, cb) {
        if (!muted) process.stdout.write(chunk, enc);
        cb();
      },
    });
    const rl = readline.createInterface({
      input: process.stdin,
      output,
      terminal: Boolean(process.stdin.isTTY),
    });
    const suffix = fallback ? ` (${fallback})` : "";
    process.stdout.write(`${question}${suffix}: `);
    muted = hidden;
    let answered = false;
    rl.question("", (answer) => {
      answered = true;
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim() || fallback);
    });
    // Input ended without an answer (e.g. piped/closed stdin): fall back instead of hanging
    rl.on("close", () => {
      if (!answered) resolve(fallback);
    });
  });
}

async function checkConnection(env) {
  try {
    await mongoose.connect(config.getMongoUri(env), {
      ...config.getConnectOptions(env),
      serverSelectionTimeoutMS: 10000,
    });
    return null;
  } catch (error) {
    return config.explainConnectionError(error);
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

// Quote a value for a .env file so special characters in passwords survive
function envValue(value) {
  if (/^[\w.@:/+-]+$/.test(value)) return value;
  const quote = ['"', "'", "`"].find((q) => !value.includes(q));
  if (!quote) {
    console.error("The value contains \", ' and ` together, which a .env file cannot hold.");
    process.exit(1);
  }
  return `${quote}${value}${quote}`;
}

const envPath = args.out ? path.resolve(String(args.out)) : path.join(backend, ".env");

async function main() {
  console.log("\nAsset Manager setup\n");
  console.log("You need a free MongoDB Atlas account with a database user.");
  console.log("Steps are in README.md under 'Create your database'.\n");

  if (existsSync(envPath) && !args.force) {
    if (!process.stdin.isTTY) {
      console.error(`${envPath} already exists. Re-run with --force to overwrite it.`);
      process.exit(1);
    }
    const answer = await ask(`${path.relative(root, envPath)} already exists. Overwrite? (y/N)`);
    if (!/^y(es)?$/i.test(answer)) {
      console.log("Nothing changed.");
      return;
    }
  }

  if (!process.stdin.isTTY && !(args.username && args.password && args.cluster)) {
    console.error(
      "No interactive terminal. Run this in a terminal, or pass --username, --password and --cluster."
    );
    process.exit(1);
  }

  const username = args.username || (await ask("Database username"));
  const password = args.password || (await ask("Database password", { hidden: true }));
  const cluster = config.normalizeCluster(
    args.cluster || (await ask("Cluster address (e.g. cluster0.abc12.mongodb.net)"))
  );
  // Only ask for the database name in the interactive flow; flags imply "use the defaults"
  const allGiven = args.username && args.password && args.cluster;
  const dbName =
    args.db ||
    (allGiven
      ? config.DEFAULT_DB_NAME
      : await ask("Database name", { fallback: config.DEFAULT_DB_NAME }));

  if (!username || !password || !cluster) {
    console.error("Username, password and cluster address are all required.");
    process.exit(1);
  }

  const env = {
    MONGO_USERNAME: String(username),
    MONGO_PASSWORD: String(password),
    MONGO_CLUSTER: cluster,
    DB_NAME: String(dbName),
  };

  if (!args["skip-check"]) {
    process.stdout.write("\nChecking the connection... ");
    const problem = await checkConnection(env);
    if (problem) {
      console.log("failed\n");
      console.error(problem);
      console.error("\nNothing was saved. Fix the problem above and run the setup again.");
      process.exit(1);
    }
    console.log("OK");
  }

  const lines = Object.entries(env).map(([k, v]) => `${k}=${envValue(v)}`);
  writeFileSync(envPath, `${lines.join("\n")}\n`);
  console.log(`\nSaved ${path.relative(root, envPath) || envPath}`);
  console.log('All set. Start the app with "npm start".');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
