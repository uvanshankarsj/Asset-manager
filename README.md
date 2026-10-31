# Expensio (Asset Manager)

A personal investment, asset and expense tracker. Sign up, record your FDs, mutual funds, shares and other assets, and see what needs attention at a glance. Each account only ever sees its own data.

Built with React 19 + TypeScript + Vite (frontend) and Express 5 + MongoDB Atlas (backend).

## Features

- **Accounts**: register, log in and log out. Passwords are hashed with bcrypt and sessions use 7-day JWTs. Every record belongs to one account and the API filters by it.
- **Profile picture**: upload a photo (cropped to a square in the browser) or fall back to your initial. It is saved to your account.
- **Home dashboard**: FDs that have matured, SIPs that are due, recent transactions and a chart of your holdings.
- **Expenses / new records**: add an FD (with maturity date), a mutual fund (with next-SIP date), shares or other items.
- **Investments**: list, edit and delete holdings. Shares track quantity, average price and ticker, with live prices and ticker search.
- **Assets**: add, edit and delete assets such as property or gold.
- **FD and SIP handling**: confirm and delete a matured FD. Paying a SIP moves its next date forward one month. Everything is logged in Recent Transactions.
- **Edit records**: change names, dates, amounts, quantities and tickers from a modal.
- **Validation and feedback**: inline field errors, toast messages for success and failure, loading states, and a "session expired" logout on a 401.
- **Responsive layout**: on screens under 768px the sidebar becomes a slide-in menu and pages scroll normally.

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
| `npm run test:e2e` | End-to-end API tests: FD / SIP flow, accounts, data isolation, avatars, editing (see below) |
| `npm run claim-data -- <email>` | Assigns records created before accounts existed (no owner) to the account with that email |

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
| `JWT_SECRET` | Long random string used to sign login tokens. If unset, a random one is used and everyone is logged out on each restart. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `CORS_ORIGIN` | Browser origins allowed to call the API, comma separated (default `http://localhost:5173,http://127.0.0.1:5173`). Set it to your site's address when you host the frontend |
| `TRUST_PROXY` | Number of reverse proxies in front of the backend when deployed (usually `1` on Render or Railway), so the login limit sees real client IPs. Leave unset locally |
| `AUTH_MAX_ATTEMPTS`, `AUTH_MAX_SIGNUPS` | Failed logins per 15 minutes and sign-ups per hour, per IP address (defaults 10 and 20) |
| `MONGO_URI` | Optional. A full connection string that replaces the three `MONGO_*` values above |
| `MONGO_CERT_PATH` | Optional. Client certificate, if you use certificate authentication |

If you run the backend somewhere other than `http://localhost:3001`, set `VITE_API_URL` for the frontend (for example in a `.env` file in the project root).

`backed/.env` holds your password. It is git-ignored, so it never gets committed. Do not share it.

## API

Everything under `/api` except `/api/auth/register` and `/api/auth/login` needs an `Authorization: Bearer <token>` header.

| Method and path | Purpose |
|---|---|
| `POST /api/auth/register`, `POST /api/auth/login` | Create an account or log in, returns a token and the user |
| `GET /api/auth/me` | Current user |
| `PUT /api/auth/avatar`, `DELETE /api/auth/avatar` | Set or remove the profile picture |
| `POST /api/expenses`, `GET /api/expenses/recent` | Add a record, list recent ones |
| `GET /api/getamount` | Totals per category |
| `GET /api/pending-actions` | Matured FDs and due SIPs |
| `DELETE /api/expenses/:id`, `POST /api/expenses/:id/sip-paid` | Remove a matured FD, mark a SIP paid |
| `GET /api/investments`, `PUT` / `DELETE /api/investments/:id` | List, edit, delete holdings |
| `GET /api/investments/prices`, `GET /api/stocks/search` | Live share prices, ticker search |
| `GET /api/assets`, `POST /api/assets`, `PUT` / `DELETE /api/assets/:id` | Manage assets |
| `GET /api/activity/recent`, `GET /api/activity/all` | Transaction log |

## Troubleshooting

| Message | Fix |
|---|---|
| `Authentication failed` | Use the Database User from Atlas > Database Access, not your Atlas login. Re-run `npm run setup` to re-enter it. |
| `Cluster address not found` | Copy the address again from Atlas > Connect > Drivers. |
| `Could not reach the cluster` | Add your current IP in Atlas > Network Access. Your IP changes on a new network. |
| `Port 3001 / 5173 already in use` | Close the other app using it, or set `PORT` in `backed/.env`. |
| The page shows "Could not load data from the server" | The backend is not running. Use `npm start`, which runs both. |

## Tests

`npm run test:e2e` runs against the real backend and database. It registers throwaway users and creates temporary records (named `__test_...`), simulates dates passing, and deletes everything afterwards. It checks FD maturity, SIP payment, the Recent Transactions log, totals, guards against repeated actions, per-account data isolation, profile pictures and record editing.

Add `SCREENSHOTS=1` to also save screenshots of the home screen to `tests/e2e/screenshots/` (needs the app running and Microsoft Edge).

### Browser tests

`npm run test:ui` drives the real app in Microsoft Edge with a throwaway account (login, add / edit / delete records, validation, profile photo, mobile menu, and that Log out is always visible at many window sizes). Start the app first with `npm start`. Set `EDGE_PATH` if Edge is installed somewhere else. The account and its data are deleted afterwards.

### Demo video

`npm run demo` records a captioned walkthrough of the app to `tests/demo/expensio-demo.mp4`. It needs the app running and one extra package that is not saved in `package.json` (it downloads a large binary): `npm install --no-save ffmpeg-static`.

## Project layout

```
src/            React frontend
backed/         Express + MongoDB backend
scripts/        Setup and claim-data scripts
tests/e2e/      API end-to-end tests
tests/ui/       Browser tests (Edge)
tests/demo/     Demo video and the script that records it
test-screenshots/  Screenshots from manual and browser testing
```
