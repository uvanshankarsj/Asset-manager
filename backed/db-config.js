// Builds the MongoDB connection settings from environment variables.
// Plain JS (CommonJS) so the backend, the setup wizard and the tests can all share it.
//
// Normal setup (MongoDB Atlas, username + password):
//   MONGO_USERNAME, MONGO_PASSWORD, MONGO_CLUSTER, DB_NAME (optional)
// Advanced overrides:
//   MONGO_URI                      full connection string (replaces the three vars above)
//   MONGO_CERT_PATH                X.509 client certificate, if you use certificate auth

const DEFAULT_DB_NAME = 'asset_manager';

// Accepts "cluster0.abc12.mongodb.net" or a pasted full connection string and returns the host.
function normalizeCluster(input) {
  let host = String(input || '').trim();
  host = host.replace(/^mongodb(\+srv)?:\/\//i, '');
  if (host.includes('@')) host = host.slice(host.lastIndexOf('@') + 1);
  return host.split(/[/?]/)[0].trim();
}

function getMongoUri(env = process.env) {
  if (env.MONGO_URI) return env.MONGO_URI;

  const missing = ['MONGO_USERNAME', 'MONGO_PASSWORD', 'MONGO_CLUSTER'].filter((k) => !env[k]);
  if (missing.length) {
    throw new Error(`Missing ${missing.join(', ')} in backed/.env. Run "npm run setup" to create it.`);
  }
  const user = encodeURIComponent(env.MONGO_USERNAME);
  const pass = encodeURIComponent(env.MONGO_PASSWORD);
  return `mongodb+srv://${user}:${pass}@${normalizeCluster(env.MONGO_CLUSTER)}/?retryWrites=true&w=majority`;
}

function getConnectOptions(env = process.env) {
  const options = { dbName: env.DB_NAME || DEFAULT_DB_NAME };
  if (env.MONGO_CERT_PATH) {
    options.tls = true;
    options.tlsCertificateKeyFile = env.MONGO_CERT_PATH;
  }
  return options;
}

// Turns a driver error into advice a first-time user can act on.
function explainConnectionError(error) {
  const text = `${error && error.code ? error.code + ' ' : ''}${error && error.message ? error.message : error}`;
  if (/auth|bad auth|Authentication failed/i.test(text)) {
    return 'Authentication failed. Check the username and password. Use the Database User you created in Atlas (Database Access), not your Atlas login.';
  }
  if (/ENOTFOUND|EREFUSED|querySrv|getaddrinfo/i.test(text)) {
    return 'Cluster address not found. Copy it from Atlas > Connect > Drivers. It looks like cluster0.abc12.mongodb.net.';
  }
  if (/ServerSelection|timed out|ETIMEDOUT|whitelist|not allowed|IP/i.test(text)) {
    return 'Could not reach the cluster. In Atlas open Network Access and add your current IP address (or 0.0.0.0/0 for testing).';
  }
  return `Could not connect: ${text}`;
}

module.exports = {
  DEFAULT_DB_NAME,
  normalizeCluster,
  getMongoUri,
  getConnectOptions,
  explainConnectionError,
};
