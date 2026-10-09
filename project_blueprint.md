# 🛡️ Shield AI: Autonomous Cyber Threat Intelligence Platform

**Track:** Problem Statement 5 (AI Scam & Phishing Detection Platform)  
**Objective:** Deliver an enterprise-grade, explainable threat hunting platform combining multimodal detection, deterministic heuristics, crowdsourced threat lakes, and active counter-offensives.

---

## 🏆 The Competitive Edge

| Feature | Generic Hackathon Projects | Shield AI Standard |
| :--- | :--- | :--- |
| **Output Type** | Opaque text summary ("Looks suspicious") | Explainable Visual Anatomy with verbatim highlighted text triggers |
| **Routing** | Cluttered single-page tab switcher | Full multi-page routing (`/`, `/dashboard`, `/threat-lake`, `/assistant`, `/history`) |
| **Data Layer** | Ephemeral browser state (lost on refresh) | Supabase PostgreSQL with user scan logs and Global Threat Lake |
| **Browser Integration** | Manual copy-pasting into web page | Manifest V3 Chrome Extension with 1-click active tab extraction |
| **Countermeasures** | Passive warning message | Autonomous AI Stall Bot (Scam-Baiter) + ICANN Abuse PDF Dossier |

---

## 🏗️ Technical Architecture

* **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons, React Router DOM v6.
* **Backend Gateway:** Node.js, Express 5, CORS, Dotenv (`http://localhost:3000/api`).
* **Database & Auth:** Supabase PostgreSQL with Row Level Security (RLS).
* **AI Cognitive Engine:** Google Gemini API (`gemini-2.0-flash` with `gemini-1.5-flash` fallback).
* **Threat Telemetry:** VirusTotal v3 API (with 1-hour LRU caching), Google Safe Browsing Lookup v4, Jimp + jsQR.
* **Client Surface:** Web Command Center + Chrome Extension (Manifest V3).

---

## 👥 Division of Responsibilities

* **Engineer 1 (Full-Stack Routing & DB):** Scaffold `react-router-dom` routes (`/`, `/dashboard`, `/threat-lake`, `/assistant`, `/history`), configure Supabase client, and write database triggers.
* **Engineer 2 (Backend Security Pipeline):** Enforce VirusTotal in-memory caching, multi-hop redirect uncloaking (up to 10 hops), Safe Browsing integration, and Gemini JSON schema parsing.
* **Engineer 3 (UI/UX & Forensic Export):** Design the Precision SVG Gauge, Visual Anatomy Highlighter, and client-side `jspdf` incident reporting engine.
* **Engineer 4 (Extension & Pitch Defense):** Package the Chrome Extension, calibrate pre-loaded demo test cases, and lead the 5–8 minute live presentation.