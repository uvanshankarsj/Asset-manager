// Assigns records created before logins existed (they have no owner) to one account.
//
//   npm run claim-data -- you@example.com
//
// Sign up in the app first, then run this once. Records that already have an owner are left alone.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run claim-data -- <email of the account that should own the old records>");
  process.exit(1);
}

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../backed");
const requireBackend = createRequire(path.join(backendDir, "package.json"));
const mongoose = requireBackend("mongoose");
requireBackend("dotenv").config({ path: path.join(backendDir, ".env"), quiet: true });
const dbConfig = requireBackend("./db-config.js");

await mongoose.connect(dbConfig.getMongoUri(), dbConfig.getConnectOptions());
try {
  const user = await mongoose.connection.collection("authusers").findOne({ email });
  if (!user) {
    console.error(`No account with the email ${email}. Sign up in the app first.`);
    process.exitCode = 1;
  } else {
    for (const name of ["transactions", "assets", "activities"]) {
      const res = await mongoose.connection
        .collection(name)
        .updateMany({ userId: { $exists: false } }, { $set: { userId: user._id } });
      console.log(`${name}: ${res.modifiedCount} record(s) assigned to ${email}`);
    }
  }
} finally {
  await mongoose.disconnect();
}
