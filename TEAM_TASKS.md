# 🚀 Sentinel: Remaining Tasks & Team Work Division

> **Hackathon Goal:** Transform our working prototype into a 1st-place winning solution for **Problem Statement 5 (AI Scam & Phishing Detection)**.

---

## 📊 Current Status: Where We Stand

We have built a strong foundation with an Express server, VirusTotal & Safe Browsing telemetry, redirect unwrapping, and Gemini AI analysis. However, **critical feature gaps remain** that will cause live demo failures if not addressed before judging.

| Component | Status | Remaining Gap to Fix |
| :--- | :--- | :--- |
| **Backend Core** | 🟢 Operational | 🔴 **SMS/WhatsApp Screenshots Fail:** Image handler only scans QR codes. Non-QR screenshots currently crash with an error. Need Gemini Vision OCR fallback. |
| **API Endpoints** | 🟢 Operational | 🟡 Need `/api/analyze` endpoint alias matching the exact JSON contract in the blueprint. |
| **Input Vectors** | 🟡 Partial | 🔴 **Missing Demo Files:** No physical QR ticket images, SMS screenshots, or test files stored in the repository for judging. |
| **Frontend UI** | 🟢 Operational | 🟡 Need 1-Click Demo Scenario loader buttons and interactive hover tooltips on text highlights. |
| **Chrome Extension**| 🔴 **0% Built** | 🔴 Manifest V3 Chrome Extension folder and popup do not exist yet. |

---

## 👥 Task Assignments by Member

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SENTINEL WORK DIVISION                          │
├──────────────────┬──────────────────┬──────────────────┬───────────────┤
│   MEMBER 1       │   MEMBER 2       │   MEMBER 3       │   MEMBER 4    │
│   Backend & AI   │ Ingestion & Demo │ Frontend & SOC   │ Extension &   │
│   Intelligence   │   Assets         │   Dashboard      │   Pitch Lead  │
└──────────────────┴──────────────────┴──────────────────┴───────────────┘
```

---

### 🧠 Member 1: AI Engine & Backend Core
**Primary Files:** `services/geminiService.js`, `services/threatIntelService.js`, `routes/apiRoutes.js`

* [ ] **Fix Screenshot Handling (Gemini Vision OCR Fallback)**
  * Update `threatIntelService.js`: If `decodeQRCode()` returns no QR code when an image is uploaded, pass the image base64 to Gemini Vision (`gemini-1.5-flash`) to perform OCR and extract text automatically.
* [ ] **Add `/api/analyze` Endpoint Alias**
  * Create `POST /api/analyze` in `routes/apiRoutes.js` that returns the exact JSON schema defined in `project_blueprint.md` (`risk_score`, `verdict`, `flags`, `virustotal_data`, `recommended_action`).
* [ ] **Live Demo Safeguard (API Rate-Limit Caching)**
  * Add a safety cache or fallback handler so if the Gemini API or VirusTotal hits a 429 quota limit during live judging, the server returns cached/mock data instead of throwing an error.

---

### 🔍 Member 2: Data Extraction, Homoglyphs & Demo Assets
**Primary Files:** `services/redirectService.js`, new `services/domainService.js`, `public/assets/demo/`

* [ ] **Generate & Store 3 Demo Image/Text Files**
  * Create a `public/assets/demo/` folder and generate the 3 official demo files:
    1. `quishing_ticket.png`: Fake parking fine image with an embedded shortener QR code.
    2. `sms_scam_screenshot.png`: Screenshot of a "Mom I lost my phone, send money" SMS.
    3. `ceo_phishing_email.txt`: Corporate gift card request email.
* [ ] **Typosquatting & Homoglyph Domain Detection**
  * Build a domain inspector helper to flag spoofed characters (e.g., `paypa1.com`, `hdfc-verify.xyz`, or raw IP addresses like `http://0x7f000001`).
* [ ] **Email Header Inspection**
  * Add logic to detect discrepancies between the displayed `From:` name and actual SMTP sender address in email headers.

---

### 🎨 Member 3: Frontend SOC Dashboard & Visual Anatomy
**Primary Files:** `public/index.html`, `public/app.js`

* [ ] **Add 3 Instant 1-Click Demo Buttons**
  * Add 3 prominent buttons above the main input box:
    * `[ ⚡ Demo 1: QR Ticket ]`
    * `[ ⚡ Demo 2: Urgent SMS ]`
    * `[ ⚡ Demo 3: CEO Email ]`
  * Clicking any button auto-fills the input and triggers the scan instantly so the team doesn't spend time copy-pasting during the 3-minute pitch.
* [ ] **Interactive Hover Tooltips on Highlighted Text**
  * When hovering or clicking on yellow/red/blue highlighted text in the analysis result, display a popover showing:
    * **Trigger Category** (e.g., *False Urgency*, *Unverified Domain*, *Credential Request*).
    * **AI Reason** (why this specific snippet was flagged).
* [ ] **Export SOC Incident Report Button**
  * Add a `[ 📄 Export SOC Report ]` button to generate a clean incident summary (Risk Score, VirusTotal Engine Count, Redirect Chain, Recommended Defense) formatted for copy/PDF export.

---

### 🎤 Member 4: Chrome Extension & Demo / Pitch Lead
**Primary Files:** `extension/` directory, Presentation Deck & Live Demo Script

* [ ] **Build Manifest V3 Chrome Extension**
  * Create `extension/` directory with:
    * `manifest.json`: Manifest V3 setup with permissions for `activeTab`, `contextMenus`, `scripting`.
    * `popup.html` & `popup.js`: Mini Sentinel scanner UI calling `http://localhost:3000/api/scan`.
    * `background.js`: Add a right-click context menu option *"Scan selected text with Sentinel AI"*.
* [ ] **Prepare the 5-Slide Pitch Deck**
  * Slide 1: The Problem (QR Quishing, SMS scams, 3.4B phishing emails/day).
  * Slide 2: The Solution (Sentinel: Multi-vector, Visual Attack Anatomy, Scam-baiting).
  * Slide 3: Technical Architecture (Express → Unwrapper → VirusTotal/SafeBrowsing → Gemini 1.5 Flash).
  * Slide 4: Differentiators (Visual explainability vs. generic text output).
  * Slide 5: Future Roadmap & Market Impact.
* [ ] **Rehearse 3-Minute Live Demo & Record Failsafe Video**
  * Practice the 3-minute pitch timing and record a backup 60-second screen recording video.

---

## ⏱️ Timeline & Definition of Done

1. **Phase 1 (Next 2 Hours):** Member 1 fixes screenshot OCR; Member 2 creates demo files; Member 3 adds 1-click buttons; Member 4 creates `extension/manifest.json`.
2. **Phase 2 (Next 2 Hours):** End-to-end integration testing using the 3 pre-loaded demo scenarios.
3. **Phase 3 (Final Phase):** Pitch rehearsals, extension loaded in Chrome developer mode, backup demo video recorded.
