# 🔍 Shield AI — Complete Feature Guide & How Everything Works

This guide explains **how every single feature in Shield AI works under the hood**, from user interactions in the browser extension and web dashboard to backend pipelines, machine learning heuristics, and database isolation.

---

## 📑 Table of Contents

1. [On-Demand "Squeeze" Sidebar UI](#1-on-demand-squeeze-sidebar-ui)
2. [Real-Time Auto-URL Scanning & Redirect Unraveler](#2-real-time-auto-url-scanning--redirect-unraveler)
3. [Interactive Snipping Tool & Gemini Vision OCR](#3-interactive-snipping-tool--gemini-vision-ocr)
4. [Brand Homoglyph & Typosquatting Detection Engine](#4-brand-homoglyph--typosquatting-detection-engine)
5. [QR Code (Quishing) Matrix Decoder & Follower](#5-qr-code-quishing-matrix-decoder--follower)
6. [User-Scoped Threat History & Row-Level Security (RLS)](#6-user-scoped-threat-history--row-level-security-rls)
7. [Ask Shield (Context-Aware Security Copilot)](#7-ask-shield-context-aware-security-copilot)
8. [Autonomous Scam-Baiter Countermeasure Bot](#8-autonomous-scam-baiter-countermeasure-bot)
9. [Forensic SOC Incident Report PDF Generator](#9-forensic-soc-incident-report-pdf-generator)
10. [Account Recovery & Credential Compromise Wizard](#10-account-recovery--credential-compromise-wizard)

---

## 1. On-Demand "Squeeze" Sidebar UI

### 💡 What It Does
Provides an on-demand security panel that **physically compresses the host webpage** to the left rather than floating over and blocking page content. Modeled after modern productivity tools (**Sider AI** and **REC Note**).

```
+----------------------------------------------------+--------------------------+
|  Host Webpage Viewport (Squeezed Margin)           | Shield AI Squeeze Panel  |
|                                                    |                          |
|  * width: calc(100% - 420px)                       |  [ Auto-Scan: ON ]  [X]  |
|  * margin-right: 420px                             |  [ Scan Area (Snip) ]    |
|  * transition: margin 0.28s ease, width 0.28s      |                          |
|                                                    |  AUTO-URL VERDICT        |
|  [ Suspicious Form / Shady QR / Phishing Copy ]    |  98 / 100 Risk · BLOCKED |
|                                                    |                          |
|                                                    |  SNIPPED THREAT REPORT   |
|                                                    |  • Credential harvester  |
|                                                    |  • Fake brand copy       |
+----------------------------------------------------+--------------------------+
```

### ⚙️ How It Works (Under the Hood)
1. **Zero DOM Clutter on Load:** When the user visits any website, the extension injects zero intrusive UI by default.
2. **Toggle Trigger:** When the user clicks the Chrome extension action icon (or the small edge floating launcher pill), `background.js` sends a message to `content.js`.
3. **Physical Viewport Squeezing:** `content.js` dynamically toggles a class on the host webpage's root `<html>` element:
   ```css
   html.shield-squeeze-active {
     width: calc(100% - 420px) !important;
     margin-right: 420px !important;
     transition: width 0.28s cubic-bezier(0.16, 1, 0.3, 1),
                 margin-right 0.28s cubic-bezier(0.16, 1, 0.3, 1) !important;
   }
   ```
   *The host page smoothly shrinks into the remaining viewport area, ensuring forms, text, and buttons remain 100% clickable.*
4. **Sandboxed Iframe:** The sidebar UI (`public/extension/sidebar.html`) is loaded inside a high `z-index` fixed iframe (`#shield-squeeze-sidebar-frame`). This ensures the host website's CSS and JavaScript cannot alter, break, or read the security sidebar.

* **Key Files:** [`public/extension/content.js`](file:///c:/Users/AASHAY%20KULAKRNI/Downloads/TCET_Hackathon/TCET_Hackathon/TCET-hackathon/public/extension/content.js), [`public/extension/sidebar-host.css`](file:///c:/Users/AASHAY%20KULAKRNI/Downloads/TCET_Hackathon/TCET_Hackathon/TCET-hackathon/public/extension/sidebar-host.css), [`public/extension/sidebar.js`](file:///c:/Users/AASHAY%20KULAKRNI/Downloads/TCET_Hackathon/TCET_Hackathon/TCET-hackathon/public/extension/sidebar.js).

---

## 2. Real-Time Auto-URL Scanning & Redirect Unraveler

### 💡 What It Does
Automatically analyzes the webpage the user is actively visiting, tracing hidden redirect hops to reveal where shortlinks or deceptive links actually lead.

### ⚙️ How It Works (Under the Hood)
1. **Navigation Event Capture:** When the sidebar is toggled, `sidebar.js` queries `chrome.tabs.query({ active: true, currentWindow: true })` to obtain the active tab's URL.
2. **Recursive Redirect Unwrapping:** The URL is dispatched to `/api/scan`. The backend redirect service ([`services/redirectService.js`](file:///c:/Users/AASHAY%20KULAKRNI/Downloads/TCET_Hackathon/TCET_Hackathon/TCET-hackathon/services/redirectService.js)) performs non-following HTTP `HEAD` probes up to 10 hops:
   ```
   http://bit.ly/hdfc-kyc-verify-2024
       ↳ [HTTP 301] https://hdfcbankunofficil.in/login
           ↳ [HTTP 302] https://hdfcbankunofficil.in/login/otp-verify.php (Final Target)
   ```
3. **Telemetry Synthesis:**
   * **VirusTotal API v3:** Evaluates the final destination against 70+ antivirus engines.
   * **Google Safe Browsing API v4:** Checks if any URL in the redirect chain is on the global threat registry.
4. **Instant Score & Verdict:** Returns a unified score (`0–100`), specific threat classification (e.g. *Banking Phishing*), and color-coded badge (*Safe*, *Suspicious*, or *Critical Threat*).

* **Key Files:** [`services/redirectService.js`](file:///c:/Users/AASHAY%20KULAKRNI/Downloads/TCET_Hackathon/TCET_Hackathon/TCET-hackathon/services/redirectService.js), [`services/threatIntelService.js`](file:///c:/Users/AASHAY%20KULAKRNI/Downloads/TCET_Hackathon/TCET_Hackathon/TCET-hackathon/services/threatIntelService.js), [`routes/apiRoutes.js`](file:///c:/Users/AASHAY%20KULAKRNI/Downloads/TCET_Hackathon/TCET_Hackathon/TCET-hackathon/routes/apiRoutes.js).

---

## 3. Interactive Snipping Tool & Gemini Vision OCR

### 💡 What It Does
Allows users to click **"Scan Area"**, drag a selection box over any suspicious screen element (e.g. shady QR code, fake login box, urgent countdown, suspicious payment button), and have Gemini AI analyze the exact visual region.

### ⚙️ How It Works (Under the Hood)
1. **Screen Dimming:** Clicking "Scan Area" instructs `content.js` to mount `#shield-snip-overlay` over the host page with `cursor: crosshair`.
2. **Coordinate Selection:** As the user drags the mouse, a dynamic selection rectangle shows the exact bounding box in real time (`startX`, `startY`, `width`, `height`).
3. **Contextual DOM Text Harvest:** While coordinates are captured, `content.js` inspects all DOM elements within the bounding box to extract text nodes, link URLs, and form input names.
4. **Canvas Coordinate Crop:** `background.js` calls `chrome.tabs.captureVisibleTab({ format: 'png' })` to take a raw viewport screenshot. It loads the image into an offscreen HTML5 `<canvas>` element and crops the exact slice defined by the user's coordinates.
5. **Multimodal Gemini Vision OCR:** The cropped PNG image and the extracted text context are transmitted to `/api/scan`. Google Gemini 3.5/3.8 Flash reads the image typography, inspects logos, and flags deceptive forms:
   * Detects fake banking logos.
   * Highlights coercive phrases (*"Your account will be terminated in 2 hours"*).
   * Identifies unverified password/OTP input forms.

* **Key Files:** [`public/extension/content.js`](file:///c:/Users/AASHAY%20KULAKRNI/Downloads/TCET_Hackathon/TCET_Hackathon/TCET-hackathon/public/extension/content.js), [`public/extension/background.js`](file:///c:/Users/AASHAY%20KULAKRNI/Downloads/TCET_Hackathon/TCET_Hackathon/TCET-hackathon/public/extension/background.js), [`services/geminiService.js`](file:///c:/Users/AASHAY%20KULAKRNI/Downloads/TCET_Hackathon/TCET_Hackathon/TCET-hackathon/services/geminiService.js).

---

## 4. Brand Homoglyph & Typosquatting Detection Engine

### 💡 What It Does
Detects deceptive lookalike domains that visually mimic major trusted brands using letter or number substitutions (e.g. `www.rnicrosoft.com`, `arnazon.com`, `goog1e.com`, `paypa1.com`).

### ⚙️ How It Works (Under the Hood)
1. **Visual Pattern Normalization:** In [`services/threatIntelService.js`](file:///c:/Users/AASHAY%20KULAKRNI/Downloads/TCET_Hackathon/TCET_Hackathon/TCET-hackathon/services/threatIntelService.js), `detectTyposquatting()` strips protocols and `www.` prefixes to isolate the core domain name.
2. **Homoglyph Replacement Rules:**
   * **`rn` $\rightarrow$ `m` substitution:** Replaces adjacent `r` and `n` characters to test if the word forms a major brand:
     * `rnicrosoft` $\rightarrow$ `microsoft` (Flagged: Impersonating Microsoft)
     * `arnazon` $\rightarrow$ `amazon` (Flagged: Impersonating Amazon)
     * `instagrarn` $\rightarrow$ `instagram` (Flagged: Impersonating Instagram)
   * **Number-for-Letter substitution:**
     * `0` $\rightarrow$ `o` (`micros0ft`, `faceb00k`)
     * `1` $\rightarrow$ `l` (`goog1e`, `paypa1`, `netf1ix`)
   * **Punycode / IDN Encoded Domains:** Detects internationalized domain prefixes (`xn--`).
3. **Security Evidence Floor Enforcement:** Any detected typosquatting domain automatically triggers `applyEvidenceFloor()`:
   * **Enforced Score:** Locked at **`95–98 / 100` (Critical Danger)**.
   * **Threat Classification:** Tagged as *Brand Impersonation / Typosquatting*.
   * Prevents attackers from bypassing security simply by mimicking legitimate brand typography.

* **Key Files:** [`services/threatIntelService.js`](file:///c:/Users/AASHAY%20KULAKRNI/Downloads/TCET_Hackathon/TCET_Hackathon/TCET-hackathon/services/threatIntelService.js), [`routes/apiRoutes.js`](file:///c:/Users/AASHAY%20KULAKRNI/Downloads/TCET_Hackathon/TCET_Hackathon/TCET-hackathon/routes/apiRoutes.js).

---

## 5. QR Code (Quishing) Matrix Decoder & Follower

### 💡 What It Does
Detects, decodes, and evaluates QR codes from uploaded images or snipped screen areas, protecting users from "Quishing" (QR Phishing) where malicious links are hidden inside image barcodes.

### ⚙️ How It Works (Under the Hood)
1. **Direct Matrix Decoding:** When an image is received, [`services/qrService.js`](file:///c:/Users/AASHAY%20KULAKRNI/Downloads/TCET_Hackathon/TCET_Hackathon/TCET-hackathon/services/qrService.js) decodes the raw image bitmap into an RGBA pixel array using `Jimp`.
2. **Barcode Algorithm (`jsQR`):** Analyzes position detection patterns (the 3 corner squares), unmasks data bits, and extracts the payload string (URL or text).
3. **Automated Threat Pipeline:** The decoded URL is automatically run through:
   * Redirect hopping (following shortlinks).
   * VirusTotal and Google Safe Browsing reputation.
   * Typosquatting detection.
   * Gemini multimodal context evaluation.
4. **Accurate Safety Distinction:**
   * Legitimate QR codes (e.g. Google Support, restaurant menus) receive **`0 / 100` (Safe)**.
   * Shady marketing surveys receive **`45–60 / 100` (Suspicious)**.
   * Banking KYC or credential harvesting QR codes receive **`90–98 / 100` (Danger)**.

* **Key Files:** [`services/qrService.js`](file:///c:/Users/AASHAY%20KULAKRNI/Downloads/TCET_Hackathon/TCET_Hackathon/TCET-hackathon/services/qrService.js), [`scripts/verify-qr-suite.js`](file:///c:/Users/AASHAY%20KULAKRNI/Downloads/TCET_Hackathon/TCET_Hackathon/TCET-hackathon/scripts/verify-qr-suite.js).

---

## 6. User-Scoped Threat History & Row-Level Security (RLS)

### 💡 What It Does
Ensures complete privacy and data isolation: **each user sees ONLY their own scan history and asked questions**. No user can ever see another account's scans or mock sample data.

### ⚙️ How It Works (Under the Hood)
1. **Supabase JWT Verification:** All authenticated requests pass through `requireUser` in [`routes/apiRoutes.js`](file:///c:/Users/AASHAY%20KULAKRNI/Downloads/TCET_Hackathon/TCET_Hackathon/TCET-hackathon/routes/apiRoutes.js), extracting `req.userId` directly from the verified Supabase Auth JWT.
2. **PostgreSQL Row-Level Security (RLS):**
   * The database enforces RLS policies at the table level:
     ```sql
     CREATE POLICY "Users view own scans" ON scan_history
       FOR SELECT USING (auth.uid() = user_id);
     ```
   * Queries strictly filter: `SELECT * FROM scan_history WHERE user_id = req.userId`.
3. **Dynamic Calendar Grouping:** The React dashboard ([`src/App.tsx`](file:///c:/Users/AASHAY%20KULAKRNI/Downloads/TCET_Hackathon/TCET_Hackathon/TCET-hackathon/src/App.tsx)) groups events by actual calendar date:
   * `Today` (e.g., *Wednesday, October 8, 2026*)
   * `Yesterday`
   * Past dates formatted as `DD-MM-YYYY`
   * Timestamps formatted as `HH:MM AM/PM` (no static "Just now" text).
4. **Clean Empty State:** When an account is new, a clean zero-state banner is displayed (*"No Threats Recorded For This Account"*) rather than dummy mock items.

* **Key Files:** [`src/App.tsx`](file:///c:/Users/AASHAY%20KULAKRNI/Downloads/TCET_Hackathon/TCET_Hackathon/TCET-hackathon/src/App.tsx), [`services/supabaseService.js`](file:///c:/Users/AASHAY%20KULAKRNI/Downloads/TCET_Hackathon/TCET_Hackathon/TCET-hackathon/services/supabaseService.js), [`supabase/migrations/002_user_accounts.sql`](file:///c:/Users/AASHAY%20KULAKRNI/Downloads/TCET_Hackathon/TCET_Hackathon/TCET-hackathon/supabase/migrations/002_user_accounts.sql).

---

## 7. Ask Shield (Context-Aware Security Copilot)

### 💡 What It Does
A conversational AI assistant embedded directly inside both the browser extension sidebar and the web console. It explains why a page was flagged, answers security questions, and provides practical advice.

### ⚙️ How It Works (Under the Hood)
1. **Context Injection:** When the user asks a question, the copilot automatically injects the active scan's technical context into the AI prompt:
   ```
   Scan Context:
   - Verdict: Confirmed Credential Phishing via Brand Typosquatting
   - Domain: www.rnicrosoft.com
   - Threat Type: Brand Impersonation
   - Flagged Snippet: Password request form
   ```
2. **Dual AI Model Failover:**
   * Primary: Google Gemini (`gemini-3.5-flash-lite` / `gemini-3.8-flash`).
   * Fallback: Groq (`qwen/qwen3.8-27b`).
   * Client-Side Heuristics: If the server is offline, a local heuristic response engine answers common questions about OTPs, passwords, and banking safety.
3. **Non-Alarmist Guidelines:** Prompt guidelines strictly prevent the AI from giving alarmist responses; it provides concise, reassuring, step-by-step instructions.

* **Key Files:** [`services/chatService.js`](file:///c:/Users/AASHAY%20KULAKRNI/Downloads/TCET_Hackathon/TCET_Hackathon/TCET-hackathon/services/chatService.js), [`services/geminiService.js`](file:///c:/Users/AASHAY%20KULAKRNI/Downloads/TCET_Hackathon/TCET_Hackathon/TCET-hackathon/services/geminiService.js), [`src/App.tsx`](file:///c:/Users/AASHAY%20KULAKRNI/Downloads/TCET_Hackathon/TCET_Hackathon/TCET-hackathon/src/App.tsx).

---

## 8. Autonomous Scam-Baiter Countermeasure Bot

### 💡 What It Does
An active defense tool that generates believable, friction-filled responses to waste scammers' time and bandwidth without putting the user at risk.

### ⚙️ How It Works (Under the Hood)
Users select an incoming scam message and choose one of 3 deception strategies:
1. **Technical Glitch:**
   * *Generated Response:* *"I tried submitting the form, but the portal keeps throwing error HTTP 502 Bad Gateway and my session token expired. Do you have an alternate link or gateway I can use?"*
2. **Bureaucratic Delay:**
   * *Generated Response:* *"Our finance department requires an official company invoice with a registered tax number and dual-signoff purchase order before disbursements over $100 can be processed. Please provide these documents."*
3. **Confused Customer:**
   * *Generated Response:* *"I want to complete this, but I cannot find where the green verification button is on my phone screen. Can I visit a physical branch tomorrow morning instead?"*

* **Safety Guardrails:** The bot strictly adheres to prompt directives:
  * Never reveals it knows this is a scam.
  * Never provides real passwords, bank accounts, OTPs, or addresses.
  * Creates realistic friction requiring more effort from the scammer.

* **Key Files:** [`services/geminiService.js`](file:///c:/Users/AASHAY%20KULAKRNI/Downloads/TCET_Hackathon/TCET_Hackathon/TCET-hackathon/services/geminiService.js), [`routes/apiRoutes.js`](file:///c:/Users/AASHAY%20KULAKRNI/Downloads/TCET_Hackathon/TCET_Hackathon/TCET-hackathon/routes/apiRoutes.js).

---

## 9. Forensic SOC Incident Report PDF Generator

### 💡 What It Does
Generates a downloadable, print-ready PDF security incident report for compliance, IT department escalation, or cybercrime reporting.

### ⚙️ How It Works (Under the Hood)
1. **Forensic Telemetry Packaging:** Gathers scan metadata:
   * Unique UUID incident scan ID.
   * Exact ISO timestamp.
   * Full redirect chain and unmasked destination URL.
   * VirusTotal engine consensus breakdown.
   * Flagged text snippets with line explanations.
2. **Client-Side Vector Rendering (`jsPDF`):** Compiles vector graphics, risk gauge indicators, and typography into a PDF document directly inside the browser.
3. **Instant Blob Download:** Generates an in-memory `Blob` and triggers a clean browser download (`shield-threat-incident-report.pdf`).

* **Key Files:** [`services/pdfService.js`](file:///c:/Users/AASHAY%20KULAKRNI/Downloads/TCET_Hackathon/TCET_Hackathon/TCET-hackathon/services/pdfService.js), [`routes/apiRoutes.js`](file:///c:/Users/AASHAY%20KULAKRNI/Downloads/TCET_Hackathon/TCET_Hackathon/TCET-hackathon/routes/apiRoutes.js).

---

## 10. Account Recovery & Credential Compromise Wizard

### 💡 What It Does
An interactive 4-step recovery checklist for users who suspect they accidentally typed their password or clicked a suspicious link before Shield stopped it.

### ⚙️ How It Works (Under the Hood)
1. **Decision Wizard:** Initiated via the "Think you typed your password?" prompt.
2. **4 Structured Stages:**
   * **Step 1 — Disconnect Session:** Immediately close open browser tabs and terminate active login sessions.
   * **Step 2 — Official Credential Reset:** Change passwords using the verified mobile app or typing the official URL directly.
   * **Step 3 — Hardware 2FA Hardening:** Enable app-based Authenticator (TOTP) or security keys to invalidate stolen passwords.
   * **Step 4 — Audit Authorized Devices:** Review linked devices and revoke unverified third-party app access tokens.
3. **Persistent Progress:** Checkbox state is synced with Supabase (`user_preferences.recovery_progress`), allowing users to resume their recovery checklist across devices.

* **Key Files:** [`src/App.tsx`](file:///c:/Users/AASHAY%20KULAKRNI/Downloads/TCET_Hackathon/TCET_Hackathon/TCET-hackathon/src/App.tsx), [`services/supabaseService.js`](file:///c:/Users/AASHAY%20KULAKRNI/Downloads/TCET_Hackathon/TCET_Hackathon/TCET-hackathon/services/supabaseService.js).

---

## 🏁 Summary Table: Feature Implementation Matrix

| Feature | Primary Environment | Primary Technologies | Key Files |
|---|---|---|---|
| **Squeeze Sidebar** | Chrome Extension | HTML5, CSS Flexbox, Manifest V3 | `content.js`, `sidebar-host.css`, `sidebar.html` |
| **Auto-URL Scanner** | Extension & Web | Express, Axios, VT API, GSB API | `redirectService.js`, `threatIntelService.js` |
| **Snipping Tool** | Chrome Extension | HTML5 Canvas, `captureVisibleTab`, Gemini Vision | `content.js`, `background.js`, `geminiService.js` |
| **Homoglyph Engine** | Extension & Backend | Regex pattern matching, Evidence Floor | `threatIntelService.js`, `apiRoutes.js` |
| **QR Decoder** | Extension & Web | `jsQR`, Jimp | `qrService.js`, `verify-qr-suite.js` |
| **Threat History** | Web App & Extension | Supabase Auth, PostgreSQL RLS, React 19 | `App.tsx`, `supabaseService.js`, `002_user_accounts.sql` |
| **Ask Shield Copilot** | Extension & Web | Gemini 3.5 Flash, Groq, Context Prompting | `chatService.js`, `geminiService.js`, `sidebar.js` |
| **Scam-Baiter** | Web Dashboard | Gemini LLM Prompt Engineering | `geminiService.js`, `apiRoutes.js` |
| **Incident PDF Export** | Web Dashboard | `jsPDF`, Blob Downloads | `pdfService.js`, `App.tsx` |
| **Recovery Wizard** | Web Dashboard | React State, Supabase Preferences | `App.tsx`, `supabaseService.js` |
