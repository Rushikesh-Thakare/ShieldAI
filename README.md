# Shield AI

Shield AI is a scam- and phishing-analysis application with a React dashboard, an Express API, Supabase-backed accounts, and a Chromium browser extension. It combines a locally trained text/URL classifier with optional Gemini, Groq, VirusTotal, and Google Safe Browsing services.

> Automated classifications are advisory, not a guarantee that content is safe or malicious. Verify sensitive requests through a trusted, independent channel.

## Contents

- [Features](#features)
- [Technology](#technology)
- [Requirements](#requirements)
- [Local setup](#local-setup)
- [Supabase setup](#supabase-setup)
- [Train the dataset model](#train-the-dataset-model)
- [Configuration](#configuration)
- [Run and verify](#run-and-verify)
- [Production deployment](#production-deployment)
- [Browser extension](#browser-extension)
- [API reference](#api-reference)
- [Privacy and security](#privacy-and-security)
- [Limitations](#limitations)
- [Troubleshooting](#troubleshooting)

## Features

- Email/password registration, confirmation, sign-in, password reset, and profile management.
- Authenticated, per-account scan history, preferences, and recovery-guide progress.
- Quick checks for URLs, messages, email text, screenshots, and QR codes.
- Detailed scan findings, risk scores, and scan timelines.
- Ask Shield chatbot with selectable Gemini/Groq providers and automatic provider failover.
- Dataset-trained classifiers for SMS spam and malicious URLs.
- Browser extension that sends authenticated active-page URL checks to the API.
- Optional URL reputation checks through VirusTotal and Google Safe Browsing.

## Technology

| Area | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite |
| API | Node.js, Express |
| Accounts and persistence | Supabase Auth, PostgREST, PostgreSQL row-level security |
| AI providers | Gemini and Groq (optional) |
| Threat intelligence | VirusTotal and Google Safe Browsing (optional) |
| Dataset classifier | JavaScript Multinomial Naive Bayes model |
| Browser extension | Chromium Manifest V3 |

## Requirements

- Node.js 20 or newer and npm.
- A Supabase project for sign-in, scan history, threat lake, and user preferences.
- API keys for live intelligence providers: Gemini Flash, VirusTotal, and Google Safe Browsing.

## Local setup

Clone the repository and install dependencies:

```sh
git clone <repository-url>
cd TCET-hackathon
npm install
```

Create a private `.env` from the example:

```sh
copy .env.example .env
```

On PowerShell, `Copy-Item .env.example .env` can be used instead. Add the required Supabase settings and whichever provider keys you want to enable; see [Configuration](#configuration).

## Supabase setup

Apply the migrations in order using the Supabase Dashboard **SQL Editor**:

1. [`001_threat_scans.sql`](./supabase/migrations/001_threat_scans.sql)
2. [`002_user_accounts.sql`](./supabase/migrations/002_user_accounts.sql)

Alternatively, with the Supabase CLI:

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

The SQL migration files are not shell commands. The migrations create threat indicators, private scan history, and per-user preferences with row-level security enabled.

In Supabase **Authentication → URL Configuration**, set the production site URL as the Site URL and add the production URL (and local development URL) to the allowed redirect URLs. Configure email confirmation and password-reset email delivery for your project.

## Live Threat Intelligence Engine

Shield AI operates strictly on a live threat intelligence pipeline:
- **Google Gemini Flash (2.0 / 1.5):** Multimodal forensic reasoning, scam explanation, and autonomous stall bot.
- **VirusTotal v3 API:** Live multi-engine URL malware and phishing detection with in-memory LRU caching.
- **Google Safe Browsing v4:** Real-time social engineering and deceptive site lookup.
- **Supabase Cloud DB:** Threat Lake shared intelligence telemetry and persistent user scans.

## Configuration

Use `.env.example` as the template. Never commit `.env` or put server-side secrets in frontend variables.

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | No | HTTP port; defaults to `3000`. |
| `SUPABASE_URL` | Yes for accounts/data | Supabase project URL used by the API. |
| `SUPABASE_ANON_KEY` | Yes for accounts/data | Public/anon Supabase key used by the API with the user's bearer token. Do not use a service-role key here. |
| `VITE_SUPABASE_URL` | Yes for frontend authentication | Same Supabase project URL, embedded at frontend build time. |
| `VITE_SUPABASE_ANON_KEY` | Yes for frontend authentication | Same public/anon key, embedded at frontend build time. This is not a secret; protect data with RLS. |
| `GEMINI_API_KEY` | No | Enables Gemini for Ask Shield and scan analysis. |
| `GEMINI_MODEL` | No | Gemini model override; default is `gemini-3-flash-preview`. |
| `GROQ_API_KEY` | No | Enables Groq for Ask Shield. |
| `GROQ_MODEL` | No | Groq model override; default is `qwen/qwen3.8-27b`. |
| `VIRUSTOTAL_API_KEY` | No | Enables VirusTotal URL reputation checks. |
| `SAFE_BROWSING_API` | No | Enables Google Safe Browsing URL checks. |

At least one AI key is recommended. Ask Shield tries the selected provider first, then the other configured provider if needed. Gemini is currently used for scan/image analysis; Groq is currently used for chat only. Provider availability, model access, quota, and billing depend on each provider account.

For local development, Vite reads `VITE_*` variables when it starts/builds. Restart the dev server after changing environment variables.

## Run and verify

Start the API and frontend together:

```sh
npm run dev
```

Open the local Vite URL printed in the terminal. The API listens on port `3000` by default; Vite proxies `/api` requests to it.

Useful checks:

```sh
npm test
npm run lint
npm run build
npm audit
```

For a production-style local run:

```sh
npm run build
npm start
```

The Express server serves the generated frontend from `dist/` and the API from the same origin.

## Production deployment

Deploy as a **Node.js web service** that runs both the Express API and the built frontend from the same origin. This is the simplest fit for the current project structure.

1. Push the repository to a private or public Git host.
2. Create a Node.js web service with the repository as its source.
3. Configure the build command:

   ```sh
   npm ci && npm run build
   ```

4. Configure the start command:

   ```sh
   npm start
   ```

5. Add the environment variables from the table above in the hosting provider's secret/environment-variable settings. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` before the build so Vite embeds the correct Supabase project in the frontend.
6. Set `PORT` only if the host requires it; the server reads the hosting platform's port.
7. Apply both Supabase migrations and configure the production Auth redirect URLs.
8. Deploy, then verify `https://YOUR_DOMAIN/api/health` reports the expected configured services (it reports key presence only, never key values).
9. Sign up, confirm the email, sign in, run a test scan, and confirm it appears in that account's history.
10. Set the extension's API base URL to `https://YOUR_DOMAIN` when connecting it to a deployed API.

The repository includes a `vercel.json`, but deployment behavior depends on Vercel's Node function packaging and inclusion of the `dist/` frontend. Verify both static frontend routes and authenticated API routes on a preview deployment before using that target in production. A Node web service is the documented/recommended deployment path for the current Express server.

### Production release checklist

- [ ] Supabase migrations have been applied.
- [ ] Supabase Site URL and redirect allowlist use the production domain.
- [ ] `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` were set before building.
- [ ] Server provider keys are configured only in the host's secret settings.
- [ ] `.env` and provider secrets are not committed to Git.
- [ ] `/api/health`, sign-up/sign-in, one scan, history, and Ask Shield have been smoke-tested.
- [ ] The extension is pointed at the deployed API and tested with a connected account.

## Browser extension

The extension is a Chromium Manifest V3 unpacked extension. It checks the active page when the popup is opened, submits the URL to the authenticated Shield API, and saves successful checks to the signed-in user's scan history.

### Install in Chrome or Edge

1. Build the project from its root folder:

   ```sh
   npm run build
   ```

2. Open `chrome://extensions` in Chrome or `edge://extensions` in Microsoft Edge.
3. Turn on **Developer mode**.
4. Select **Load unpacked** and choose the project's `dist/extension` folder. Do not select `public/extension`.
5. Pin Shield AI from the browser's Extensions menu if desired.

### Connect the extension to your account

1. Start the local app with `npm run dev`, or deploy the API first.
2. Open the extension's **Details** page and select **Extension options**, or click **Sign in to Shield** in the popup when prompted.
3. Sign in with the same email/password account used in the Shield web app. The extension connection uses a separate token session; it does not share the web app's browser login automatically.
4. In **Shield API address**, enter the API origin:
   - Local development: `http://localhost:3000`
   - Production: `https://YOUR_DEPLOYED_DOMAIN`
5. Select **Connect account** and wait for the account-connected confirmation.
6. Open the extension popup while viewing a regular `http://` or `https://` website.

Enter only the origin in the API address field. Do not append `/api`, `/api/extension/check`, or another path. The extension stores the API origin and refreshable session tokens in browser extension storage; it does not store the account password. Use HTTPS for a remote API.

### Verify an extension check

1. Confirm the API is reachable at `http://localhost:3000/api/health` locally, or `https://YOUR_DEPLOYED_DOMAIN/api/health` in production.
2. Open a regular website, then open the Shield popup. It should show the current page's domain.
3. With a connected account, the extension sends the URL to `/api/extension/check`. The backend returns the trained URL classifier's `dataset_classification` when the model artifact is deployed.
4. Open Threat history in the web app and confirm the successful extension check appears there.
5. Select **Review signals** or **See why** from the popup to inspect findings when those actions are shown.

### Updating or reconnecting

- After changing files in `public/extension/`, run `npm run build`, then select **Reload** for the extension in `chrome://extensions` or `edge://extensions`.
- Backend code or environment changes require restarting/redeploying the API; rebuilding the extension alone will not update the server.
- If the extension session expires, reconnect from the extension options page and retry the check.
- When using a deployed API, set the API address to its HTTPS origin.

### Extension troubleshooting

| Symptom | Check |
| --- | --- |
| Cannot connect or API request fails | Confirm the API is running and the address is the origin only, with the correct `http` or `https` scheme. |
| Popup says “Sign in to Shield” | Connect the extension from its options page; signing into the website does not automatically connect the extension. |
| Session expired | Reconnect with your Shield account and retry the popup check. |
| Popup shows a local/offline result | The API could not be reached or authenticated. Check the API address, `/api/health`, and server logs. Local heuristic results do not use the dataset-trained backend model. |
| Check does not appear in Threat history | Confirm the extension is connected to the intended API/account and that both Supabase migrations have been applied. |
| Extension cannot load or changes do not appear | Build again and load/reload `dist/extension`, not `public/extension`. |

The extension checks the current page when its popup is opened. Its local navigation warning is heuristic-based and does not query the trained backend model on every navigation. The extension requires permissions to inspect the active tab and page signals and to contact the configured API. URLs sent to the backend may also be sent to configured reputation providers; review [Privacy and security](#privacy-and-security) before using it.

## API reference

Private endpoints require `Authorization: Bearer <Supabase access token>`.

| Method and path | Authentication | Description |
| --- | --- | --- |
| `GET /api/health` | No | Reports whether provider configuration is present. |
| `POST /api/analyze` | Yes | Analyze submitted text, URLs, or an image. |
| `POST /api/scan` | Yes | Alias for scan analysis. |
| `POST /api/extension/auth` | No | Sign in the extension with a Shield account. |
| `POST /api/extension/refresh` | No | Refresh an extension session. |
| `POST /api/extension/check` | Yes | Analyze a URL using the same backend checks and trained URL model. |
| `POST /api/ask` | Yes | Ask Shield; accepts `question`, optional `context`, and optional `provider` (`gemini` or `groq`). |
| `GET /api/history` | Yes | Read the signed-in user's scan history. |
| `GET /api/preferences` | Yes | Read the signed-in user's settings and recovery progress. |
| `PUT /api/preferences` | Yes | Save settings and recovery progress. |
| `GET /api/threat-lake/trending` | No | Read aggregate threat-domain trends. |
| `GET /api/domain-reputation?domain=example.com` | No | Query configured URL reputation providers. |
| `POST /api/export/report` | Yes | Export a scan report as JSON. |

Example text analysis request:

```http
POST /api/analyze
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "input": "Your account will be suspended. Verify now at https://example.com"
}
```

Analysis responses include a risk score, risk level, verdict, summary, flags, provider telemetry, and `dataset_classification` when the text/URL classifier can run.

## Privacy and security

- Keep Gemini, Groq, VirusTotal, and Safe Browsing keys on the server. Never use `VITE_` prefixes for these secrets.
- Use only the Supabase anon key in the frontend; do not expose a Supabase service-role key.
- User scan history and preferences use row-level security. Raw message/image content is not saved as scan history; URLs/domains may be sent to configured reputation providers.
- Ask Shield sends the user's question and optional scan context to the selected AI provider. Do not submit credentials or other sensitive private content.
- URL checks disclose submitted URLs to any configured third-party reputation providers.
- Do not rely on a model score alone for consequential decisions. Classifiers can produce false positives and false negatives.
- If a credential or API key has ever been committed or shared outside its intended secret store, revoke and replace it.

## Limitations

- The trained model is a baseline Naive Bayes classifier; its reported validation scores do not guarantee performance on new data or every language/content type.
- Dataset training classifies SMS text and URLs separately; it is not an image classifier. Images are analyzed only if Gemini is configured, with QR extraction handled separately.
- Gemini/Groq and reputation services can be unavailable, rate-limited, or restricted by account/model access. The API uses local fallback analysis where applicable.
- The browser extension's backend analysis is popup-triggered. The local navigation warning is heuristic-based and does not query the dataset model on every page navigation.
- In-memory rate-limit buckets and fallback recent-scan data are process-local. Durable account history and settings are stored in Supabase.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Sign-in or confirmation redirect fails | Check Supabase Auth email settings and the site's allowed redirect URLs. |
| Scan history or settings unavailable | Confirm migrations were run in order and the API is configured with the correct Supabase URL/anon key. |
| AI fallback response | Check server logs, provider key/model configuration, account access, quota, and network availability. |
| URL reputation is unavailable | Check the relevant provider key/quota. |
| Extension asks to sign in repeatedly | Reconnect the account and confirm the extension API base URL points to the deployed API origin. |
| Frontend shows missing Supabase configuration | Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then rebuild/redeploy. |
