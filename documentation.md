<!--
  tags: documentation, architecture, spa, routing, theme-engine, changelog, events
  -->

# UITS Event Raiders - Project Documentation

Welcome to the technical documentation of the **UITS Event Raiders** Single Page Application (SPA). This document outlines the initiative's context, the project's technical architecture, component design, and its version change history.

Repository: https://github.com/oU1TS/events

---

## 1. Initiative Context
The **UITS Event Raiders** is a community-driven initiative organized by the **oU1TS Community**. 
* **Core Purpose:** Share news about academic, tech, and cultural events (hackathons, programming contests, workshops) and gather groups of interested students to attend and compete together.
* **Official Pages:** 
  * [Facebook Guild Page](https://tinyurl.com/bdhsf7b4)
  * [oU1TS Community Project](https://ou1ts.netlify.app/)
  * [Events Web Portal](https://ou1ts.github.io/events)

---

## 2. Technical Architecture & File Structure
The project is built entirely on raw, lightweight, and modern web standards: **HTML5, CSS3, and Vanilla JavaScript (ES6+)**. It is structured for zero build-time overhead and rapid loading.

```
events/
├── index.html           # Main SPA layout and templates
├── style.css            # Global stylesheet and responsive design system
├── app.js               # Main website router and JSON data renderer
├── raids.json           # Dynamic data file storing event lists
├── render.html          # Local Markdown document rendering viewer
├── render.js            # Markdown parser controller & theme syncing
├── LICENSE              # Repository license
├── README.md            # Quick-start project readme
├── css/
│   └── render.css       # Markdown viewer stylesheet (KaTeX/Highlight/TOC)
└── doc/
    ├── idea/
    │   └── Website-Prompt-for-Event-Raiders.md   # Initial specs
    ├── notes/
    │   └── phoenix-summit-2026.md                # Delegate guidelines markdown
    └── prompts/
        ├── 1. Building Event Raiders SPA.md      # Development logs
        ├── 1.1 implementation_plan.md           # Implementation blueprint
        ├── 1.2 walkthrough.md                   # Initial release summary
        └── 1.3 walkthrough.md                   # Updated release summary
```

---

## 3. Core Feature Details

### A. SPA Hash Routing
* **How it works:** The application listens to `window.location.hash` changes. When a hash is modified (e.g. `#past-raids`), `app.js` runs `routePage()`.
* **State Sync:** It adds the `.active` class to the matching section and navbar link while hiding the others. If the hash is empty or invalid, it defaults to `#home`.
* **Benefits:** Natively supports browser history (back/forward buttons) and makes direct-linking to sections (e.g. sharing the onboarding guide via `#join`) fully bookmarkable.

### B. Dynamic JSON Fetching & Dropdown Parsing
* **Data Separation:** Event records are kept in `raids.json` and fetched asynchronously via the Fetch API.
* **Collapsible Dropdowns:** The `subEvents` property in `raids.json` is a reusable array of items. `app.js` parses this array and renders semantic HTML5 `<details>` and `<summary>` components inside the schedule card.
* **XSS Prevention:** Elements (titles, prices, descriptions) are rendered dynamically using `textContent` and basic HTML escaping to block malicious script injections.

### C. Unified Theme Engine
* **Theme Switching:** Managed by toggling the `.light-theme` class on the `<body>` element.
* **CSS Custom Properties:** Both dark and light themes share identical variable tokens (e.g. `--bg-primary`, `--accent`) defined in HSL ranges for animations.
* **Preferences Sync:** The selected theme is stored in `localStorage` and synchronized automatically when loading markdown files in `render.html`. It defaults to the user's system preferences (`prefers-color-scheme`) on initial load.

### D. Markdown Notes Renderer
* **Libraries:** Uses `marked.js` for MD parsing, `DOMPurify` for sanitizing markup, `highlight.js` for syntax highlighting, and `KaTeX` for mathematical LaTeX equations.
* **Table of Contents (ToC):** Dynamically parses headers (`h1`, `h2`, `h3`, `h4`) and compiles a slide-out navigation panel with sticky header offsets.

### E. Raid Card Deep Linking & Highlight Animation
* **Deep Linking**: SPA hash routing intercepts hashes matching `#raid-<number>` (e.g. `#raid-1`), internally redirects the user to the `#past-raids` section, and identifies the target raid card.
* **Smooth Scrolling**: Once the dynamic raid data loads and renders, the page automatically performs a smooth scroll centering the targeted card in the viewport.
* **Highlight Animation**: Applies a brief pulse animation (`highlightPulse`) which scales the card slightly, updates the border to the accent color, and casts a glowing box shadow using the theme's accent color (gold for dark, blue for light).
* **Copy Link Button**: Each card features a highlighted copy button next to the status badge. Clicking it copies the absolute URL of the specific card to the clipboard and triggers a 2-second visual feedback (checkmark icon change).

---

## 4. Version History & Changelog

### 🚀 v1.5.0 — Deep Linking, Copy-to-Clipboard Buttons & Highlight Animations (Current)
* **Features:**
  * **Deep Linking to Raids**: Extended SPA hash routing to support `#raid-<number>` paths. The portal auto-routes to "Raid Campaigns", smooth-scrolls to the target card, and triggers a highlight effect.
  * **Copy Link Button**: Added a dedicated copy icon button next to the status badge on each card. Clicking copies the direct deep link (e.g. `index.html#raid-1`) to the user's clipboard.
  * **Interactive Feedback**: Implemented visual success state where the copy icon turns into a checkmark for 2 seconds.
  * **Highlight Pulse Animation**: Created `@keyframes highlightPulse` to animate the border-color and box-shadow with the theme-specific accent color glow upon deep-link activation.
  * **Data Layer Variables**: Added sequential `"Raid_Num"` properties to all objects in `raids.json` matching card positions.

### 🚀 v1.4.0 — Details Dropdown, Mobile Clamp & Future Roadmap Context
* **Features:**
  * **Collapsible Details**: Wrapped Venue, Fee, and subEvents (Schedule) inside a single premium-styled, collapsible `<details>` element labeled "Details". Styled it with dynamic theme-accented borders, custom carets, left-side indicator bars, and hover scaling.
  * **Raid Roadmap Context**: Updated the main portal context from "Past Raids" to "Raid Campaigns" and changed the hero CTA button to "View Raid Plans".
  * **Dynamic Status Badges**: Added `"Status"` and `"endDate"` tags to `raids.json`. Implemented dynamic status checks in `app.js` that automatically shift status from `"Future"` to `"Past"` once the current date passes `endDate`, rendering matching badge chips.
  * **Mobile Layout Polish**: Decreased title size on mobile viewports to `1.3rem`, placed the main description above the Details dropdown, and added a line-clamped description box with a highlighted **See More** toggle button for screens `< 768px`.
  * **Tab Behaviors**: Standardized target attributes so all links in `raids.json` (including the local `"notes"` markdown rendering link) open in a new browser tab.

### 🚀 v1.3.0 — Notes Renderer & Theme Sync Integration
* **Features:**
  * Integrated a local Markdown reader (`render.html`, `render.js`, and `css/render.css`) into the workspace to view campaign reports locally.
  * Added a `syncTheme` method to `render.js` to automatically match the viewer's theme with the homepage choice saved in `localStorage`.
  * Created `doc/notes/phoenix-summit-2026.md` containing safety guidelines, session advice, and delegation schedules.
  * Integrated `"notes"` key under `raids.json` link listings, mapping to local documents and rendering them inside `render.html` with a sheet document icon.

### 🛠️ v1.2.0 — Reusable Dropdowns & CSS pre-line Bugfix
* **Features:**
  * Refactored `subEvents` in `raids.json` from a flat string into a reusable array of collapsible summary/detail items.
  * Added HTML `<details>` rendering template in `app.js` to support multi-day schedule drawers.
  * Styled details drawers in `style.css` with transition controls and custom rotation arrows.
  * Fixed line breaks not rendering in `"fee"` metadata values by mapping `.raid-info-value` to `white-space: pre-line` in CSS.

### 📅 v1.1.0 — Real-World Data Scrape (Phoenix Summit)
* **Features:**
  * Updated `raids.json` to feature the **Phoenix Summit 2026** as the flagship event.
  * Populated the file with detailed pricing data (Student Conference/Workshop rates, Regular Passes, and Early Birds) and schedules.

### 🎉 v1.0.0 — Initial SPA Release
* **Features:**
  * Established index.html markup featuring Home, Past Raids, Join Us, and Learn More tabs.
  * Implemented responsive mobile-first grids, custom navigation animations, and slide-in hamburger headers.
  * Created theme toggle controls with a Gold/Silver dark mode palette and sky-blue light mode palette.
  * Separated data into a mock list inside `raids.json`.
