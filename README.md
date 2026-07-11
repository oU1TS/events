# UITS Event Raiders

A clean, modern, and highly responsive Single Page Application (SPA) built for the **UITS Event Raiders** initiative. 

The core purpose of this initiative is to share updates about academic, tech, and cultural events (e.g., hackathons, coding contests, symposiums) and to coordinate groups of interested students to prepare for, travel to, and compete in these events together.

👉 **Read the full [Technical Documentation & Version History](documentation.md)** for detailed structural blueprints, SPA routing mechanisms, and code designs.
👉 **Read the [JavaScript Code Learning Guide](learning.md)** for an in-depth code architecture walkthrough of the app's dynamic scripts.

---

## 🌟 Key Features

1. **Single Page Application (SPA):** Seamless navigation using URL hash routing (`#home`, `#raids`, `#notes`, `#join`, `#learn-more`) which allows full browser back/forward history and direct bookmarking.
2. **Data Separation & Dropdowns:** Event list details are loaded dynamically from a separate `raids.json` data file. Supports complex reusable schedule dropdown grids (`<details>`/`<summary>`) directly parsed from the JSON array variables.
3. **Dynamic Event Notes Section:** Dedicated reports/writeups tab listing note cards with concise shortened titles. Links to local notes load in the same tab so the back button can return readers to the homepage.
4. **Interactive Campaign Calendar:** Visual month-by-month calendar modal with overlap count badges, day events overlay list, and scroll viewport-tracking floating activation button.
5. **Type Filtering Dropdown:** Custom filter dropdown next to the calendar button to narrow down campaigns by event category. Keeps buttons aligned on a single row down to small mobile breakpoints (`380px`).
6. **Registration Deadlines Engine:** Computes remaining time or `(Closed)` warning states dynamically on card badges based on the user's system clock.
7. **Dual Theme Engine:** Stylized tactile toggle switch that flips between:
   * **Dark Mode (Default):** Tech-noir style featuring black/charcoal backgrounds and gold accents.
   * **Light Mode:** Fresh vibrant style featuring white, sky-blue, and emerald-green highlights.
   * Theme choices automatically persist via `localStorage` and honor system settings.
8. **Step-by-Step Onboarding:** Clear onboarding checklist inside `#join` to help students link up with maintainers, submit their Student ID verification, and synchronize their WhatsApp chat histories.
9. **Markdown Notes Integration:** A built-in local Markdown reader (`render.html` + `render.js`) to view delegation guidelines, preparation lists, and checklists directly on the website with theme sync, code highlighting, and LaTeX support.
10. **Local Cache-First Sync:** Aggressively fetches `tracker.json` using cache-bypassing fetch controls on page load to check remote state parameters against `localStorage` (key: `ev_tracker`), flushing local caches and downloading fresh event roadmap sheets when required.
11. **On-Screen Glassmorphic Alerts:** Warns users exactly 1 day prior to any registration end date using system web push messages and custom on-screen UI slides, saving token keys locally to avoid duplication.
12. **Background Push Notification Support:** Integrated OneSignal Web Push SDK page interfaces and globally hosted background service worker execution modules.
13. **Automated CI/CD Workflows:** Automated GitHub Actions pipeline (`.github/workflows/notify.yml`) triggered on database updates (for new raid announcements) or daily cron schedule (for upcoming registration deadlines) using Node.js REST API scripts.

---

## 📂 Project Structure

```
events/
├── .github/
│   ├── scripts/
│   │   └── send-push.js     # OneSignal REST API automated Node.js dispatch script
│   └── workflows/
│       └── notify.yml       # GHA event notification and alerting pipeline
├── index.html               # Main SPA layout skeleton (with OneSignal SDK integration)
├── style.css                # Custom CSS variables, transitions, responsive grids, and toast styles
├── app.js                   # Route controller, fetch API parsing, caching verification, and local alerts
├── OneSignalSDKWorker.js     # OneSignal background push message registration service worker
├── tracker.json             # Metadata synchronization tracking registry
├── learning.md              # Comprehensive JS code architecture & learning guide
├── raids.json               # Data file containing event lists (scraped from Phoenix Summit 2026)
├── render.html              # Local Markdown document rendering viewer
├── render.js                # Markdown viewer controller and theme synchronization
├── documentation.md         # Detailed project documentation and architecture specs
├── css/
│   └── render.css           # Markdown renderer theme styling
└── doc/
    ├── idea/                # Initiative brainstorming and mock requirements
    ├── notes/               # Custom markdown notes linked from event cards
    └── prompts/             # Historical prompts, logs, and development walkthroughs
```

---

## ⚡ How to Run Locally

Because the application fetches `raids.json` and local markdown notes asynchronously using the standard Fetch API, modern browsers will block these requests with a CORS policy if you open the `index.html` file directly using `file://`.

To run the project locally, serve the directory using a local web server:

### Option A: VS Code Live Server
1. Open the project folder in VS Code.
2. Install the **Live Server** extension.
3. Click **Go Live** in the status bar at the bottom-right of the window.

### Option B: Node.js (npx)
If you have Node.js installed, run:
```bash
npx http-server
```
Then navigate to the URL provided (usually `http://localhost:8080`).

### Option C: Python
If you have Python installed, run:
```bash
python -m http.server 8080
```
Then navigate to `http://localhost:8080` in your browser.

---

## 🤝 Community & Links
* **Official Facebook Guild:** [UITS Event Raiders Page](https://tinyurl.com/bdhsf7b4)
* **Main Open-Source Collective:** [oU1TS Community Project](https://ou1ts.netlify.app/)
* **Project Web Portal:** [oU1TS Events App](https://ou1ts.github.io/events)

<br>
