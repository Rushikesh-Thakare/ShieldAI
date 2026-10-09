# Product Requirements Document (PRD) // Shield AI

## 1. System Requirements
* **Node.js:** v18.0.0 or higher
* **Framework:** React 18 (Vite + TypeScript) + Express 5
* **Persistence:** Supabase PostgreSQL
* **External APIs:** Google Gemini API, VirusTotal API, Google Safe Browsing API

## 2. Core Functional Specifications

### F-01: Multi-Page Client Routing
* The application must implement distinct client routes via `react-router-dom`.
* Direct navigation or page refreshes on `/dashboard`, `/threat-lake`, `/assistant`, and `/history` must preserve global authentication states.
* Top navigation bar must dynamically display route breadcrumbs, active connection pills, and user authentication tokens.

### F-02: Multimodal Ingestion Pipeline
* **Text / SMS / Email:** Accept unstructured text up to 25,000 characters.
* **URL Investigation:** Perform server-side redirect tracing up to 10 hops to unmask shortened domains (`bit.ly`, `tinyurl`) before external API analysis.
* **QR Image (Quishing):** Jimp-assisted grayscale/contrast optimization and jsQR decoding directly from uploaded or clipboard-pasted images.

### F-03: Two-Tier Threat Scoring & Visual Anatomy
* Combine VirusTotal and Google Safe Browsing hits into deterministic score floors (e.g. Safe Browsing hits guarantee a score of 92+).
* Gemini API cognitive evaluation returns strict JSON with verbatim string matches.
* The frontend highlights matching substrings:
  * **Yellow:** Urgency, deadlines, panic-inducing language.
  * **Red:** Malicious domains, suspicious phone numbers, redirect shorteners.
  * **Blue:** Authority impersonation, requests for credentials or OTPs.

### F-04: Active Defense & Countermeasures
* **Stall Bot Engine:** Generates believable, context-aware counter-responses tailored to selected strategies: `technical_glitch`, `bureaucracy`, or `confused_customer`.
* **Forensic PDF Generator:** Generates a downloadable formal Incident Report containing threat grades, IoCs, hop-by-hop redirects, and raw evidence.

### F-05: Crowdsourced Threat Lake
* Every scan with a risk score >= 50 automatically upserts into the `threat_lake` table.
* The `/threat-lake` page displays a live feed of trending domains and attack frequencies.