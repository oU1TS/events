# UITS Event Raiders

A clean, modern, and highly responsive Single Page Application (SPA) built for the **UITS Event Raiders** initiative. 

The core purpose of this initiative is to share updates about academic, tech, and cultural events (e.g., hackathons, coding contests, symposiums) and to coordinate groups of interested students to prepare for, travel to, and compete in these events together.

👉 **Read the full [Technical Documentation & Version History](documentation.md)** for detailed structural blueprints, SPA routing mechanisms, and code designs.

---

## 🌟 Key Features

1. **Single Page Application (SPA):** Seamless navigation using URL hash routing (`#home`, `#past-raids`, `#join`, `#learn-more`) which allows full browser back/forward history and direct bookmarking.
2. **Data Separation & Dropdowns:** Event list details are loaded dynamically from a separate `raids.json` data file. Supports complex reusable schedule dropdown grids (`<details>`/`<summary>`) directly parsed from the JSON array variables.
3. **Dual Theme Engine:** Stylized tactile toggle switch that flips between:
   * **Dark Mode (Default):** Tech-noir style featuring black/charcoal backgrounds and gold accents.
   * **Light Mode:** Fresh vibrant style featuring white, sky-blue, and emerald-green highlights.
   * Theme choices automatically persist via `localStorage` and honor system settings.
4. **Step-by-Step Onboarding:** Clear onboarding checklist inside `#join` to help students link up with maintainers, submit their Student ID verification, and synchronize their WhatsApp chat histories.
5. **Markdown Notes Integration:** A built-in local Markdown reader (`render.html` + `render.js`) to view delegation guidelines, preparation lists, and checklists directly on the website with theme sync, code highlighting, and LaTeX support.

---

## 📂 Project Structure

```
events/
├── index.html           # Main SPA layout skeleton
├── style.css            # Custom CSS variables, transitions, and responsive grid layouts
├── app.js               # Route controller, fetch API parsing, and DOM rendering
├── raids.json           # Data file containing event lists (scraped from Phoenix Summit 2026)
├── render.html          # Local Markdown document rendering viewer
├── render.js            # Markdown viewer controller and theme synchronization
├── documentation.md     # Detailed project documentation and architecture specs
├── css/
│   └── render.css       # Markdown renderer theme styling
└── doc/
    ├── idea/            # Initiative brainstorming and mock requirements
    ├── notes/           # Custom markdown notes linked from event cards
    └── prompts/         # Historical prompts, logs, and development walkthroughs
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
