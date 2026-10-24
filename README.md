# Asset Manager

Track your investments (FDs, mutual funds, shares) in one place.

- **Home** shows what needs your attention (FDs that have matured, SIPs that are due), your recent actions, and a chart of your holdings.
- **Expenses** is where you add a new record. An FD takes a maturity date, a mutual fund takes a next-SIP date.
- When an FD matures you confirm and delete it. When a SIP is paid, its next date moves forward one month automatically. Everything you do is recorded in Recent Transactions.

Built with React + TypeScript + Vite (frontend) and Express + MongoDB (backend).

## Quick start

You need [Node.js](https://nodejs.org) 20 or newer and a free MongoDB Atlas account (steps below).

```bash
git clone <this-repo-url>
cd <repo-folder>

npm install      # installs the frontend and the backend
npm run setup    # asks for your MongoDB username and password, then saves them
npm start        # starts the backend and the app
```

Open http://localhost:5173.

## Create your database (one time, about 5 minutes)

1. Sign up at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas/register) and create a **free (M0) cluster**.
2. **Database Access** > Add New Database User. Choose a username and password. This is what you will give to `npm run setup`. It is not your Atlas login.
3. **Network Access** > Add IP Address > *Add Current IP Address* (or `0.0.0.0/0` to allow any address while testing).
4. **Connect** > **Drivers**. Copy the cluster address from the connection string. It looks like `cluster0.abc12.mongodb.net`.

Then run `npm run setup` and enter the username, password and cluster address. The setup checks the connection before it saves anything, and tells you what to fix if it can't connect.

You do not need to create the database or tables yourself. They are created automatically the first time the backend starts.

## Commands

| Command | What it does |
|---|---|
| `npm install` | Installs everything (frontend and backend) |
| `npm run setup` | Asks for your MongoDB details, tests them and writes `backed/.env` |
| `npm start` | Runs the backend (port 3001) and the frontend (port 5173) together |
| `npm run build` | Type-checks and builds the frontend into `dist/` |
| `npm run lint` | Runs ESLint |
| `npm run test:e2e` | End-to-end test of the FD / SIP flow (see below) |

`npm run setup` can also run without prompts:
`npm run setup -- --username me --password secret --cluster cluster0.abc12.mongodb.net --db asset_manager`

## Configuration

`npm run setup` writes `backed/.env`. You can also copy `backed/.env.example` and edit it by hand.

| Variable | Meaning |
|---|---|
| `MONGO_USERNAME`, `MONGO_PASSWORD` | The Atlas Database User |
| `MONGO_CLUSTER` | Cluster address, e.g. `cluster0.abc12.mongodb.net` |
| `DB_NAME` | Database name (default `asset_manager`) |
| `PORT` | Backend port (default `3001`) |
| `MONGO_URI` | Optional. A full connection string that replaces the three `MONGO_*` values above |
| `MONGO_CERT_PATH` | Optional. Client certificate, if you use certificate authentication |

If you run the backend somewhere other than `http://localhost:3001`, set `VITE_API_URL` for the frontend (for example in a `.env` file in the project root).

`backed/.env` holds your password. It is git-ignored, so it never gets committed. Do not share it.

## Troubleshooting

| Message | Fix |
|---|---|
| `Authentication failed` | Use the Database User from Atlas > Database Access, not your Atlas login. Re-run `npm run setup` to re-enter it. |
| `Cluster address not found` | Copy the address again from Atlas > Connect > Drivers. |
| `Could not reach the cluster` | Add your current IP in Atlas > Network Access. Your IP changes on a new network. |
| `Port 3001 / 5173 already in use` | Close the other app using it, or set `PORT` in `backed/.env`. |
| The page shows "Could not load data from the server" | The backend is not running. Use `npm start`, which runs both. |

## Tests

`npm run test:e2e` runs against the real backend and database. It creates temporary records (named `__test_...`), simulates dates passing, and deletes them afterwards. It checks FD maturity, SIP payment, the Recent Transactions log, totals and the guards against repeated actions.

Add `SCREENSHOTS=1` to also save screenshots of the home screen to `tests/e2e/screenshots/` (needs the app running and Microsoft Edge).

## Project layout

```
src/            React frontend
backed/         Express + MongoDB backend
scripts/        Setup script
tests/e2e/      End-to-end test
```
