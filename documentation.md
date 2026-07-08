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
* **How it works:** The application listens to `window.location.hash` changes. When a hash is modified (e.g. `#raids`), `app.js` runs `routePage()`.
* **State Sync:** It adds the `.active` class to the matching section and navbar link while hiding the others. If the hash is empty or invalid, it defaults to `#home`.
* **Benefits:** Natively supports browser history (back/forward buttons) and makes direct-linking to sections (e.g. sharing the onboarding guide via `#join`) fully bookmarkable.

### B. Dynamic JSON Fetching & Dropdown Parsing
* **Data Separation:** Event records are kept in `raids.json` and fetched asynchronously via the Fetch API.
* **Metadata Schema Expansion:** Objects in `raids.json` support standard metadata such as `"Type"` (representing categories like Hackathons, Programming, etc.) and `"RegEndDate"` (the registration deadline date in YYYY-MM-DD format).
* **Collapsible Dropdowns:** The `subEvents` property in `raids.json` is a reusable array of items. `app.js` parses this array and renders semantic HTML5 `<details>` and `<summary>` components inside the schedule card.
* **XSS Prevention:** Elements (titles, prices, descriptions) are rendered dynamically using `textContent` and basic HTML escaping to block malicious script injections.
* **Dynamic Registration Status:** `app.js` formats the registration deadline string and dynamically compares it against the local system time. It appends a colored status indicator to the metadata group inside the dropdown—closed deadlines are shown as gray/muted with a `(Closed)` label, and open deadlines are highlighted in green.

### C. Unified Theme Engine
* **Theme Switching:** Managed by toggling the `.light-theme` class on the `<body>` element.
* **CSS Custom Properties:** Both dark and light themes share identical variable tokens (e.g. `--bg-primary`, `--accent`) defined in HSL ranges for animations.
* **Preferences Sync:** The selected theme is stored in `localStorage` and synchronized automatically when loading markdown files in `render.html`. It defaults to the user's system preferences (`prefers-color-scheme`) on initial load.

### D. Markdown Notes Renderer
* **Libraries:** Uses `marked.js` for MD parsing, `DOMPurify` for sanitizing markup, `highlight.js` for syntax highlighting, and `KaTeX` for mathematical LaTeX equations.
* **Table of Contents (ToC):** Dynamically parses headers (`h1`, `h2`, `h3`, `h4`) and compiles a slide-out navigation panel with sticky header offsets.

### E. Raid Card Deep Linking & Highlight Animation
* **Deep Linking**: SPA hash routing intercepts hashes matching `#raid-<number>` (e.g. `#raid-1`), internally redirects the user to the `#raids` section, and identifies the target raid card.
* **Smooth Scrolling**: Once the dynamic raid data loads and renders, the page automatically performs a smooth scroll centering the targeted card in the viewport.
* **Highlight Animation**: Applies a brief pulse animation (`highlightPulse`) which scales the card slightly, updates the border to the accent color, and casts a glowing box shadow using the theme's accent color (gold for dark, blue for light).
* **Copy Link Button**: Each card features a highlighted copy button next to the status badge. Clicking it copies the absolute URL of the specific card to the clipboard and triggers a 2-second visual feedback (checkmark icon change).

### F. Campaign Calendar View & Mobile Swipe Multiplier
* **Campaign Calendar**: An interactive modal-based calendar view matching the `"startDate"` of each raid campaign. Enforces a perfectly square ratio and height of `50vh` (mobile) / `60vh` (desktop) at the body root level to bypass translation containment constraints.
* **Overlap & Redirection**: Displays event counts at the top-right corner of highlighted day cells when multiple events overlap. Clicking a highlighted cell slides up a vertical list overlay of event titles. Clicking a title closes the modal and deep-links directly to the card using `#raid-<number>`.
* **Scroll Multiplier (Velo-Boost)**: Detects fast flick swipe gestures on mobile screens (duration < 300ms, swipe distance > 30px) and applies a smooth scrolling boost proportional to flick speed, allowing users to scroll further per swipe.

### G. Event Type Dropdown Filtering & Row Wrapping
* **Category Filtering:** A custom dropdown button container is placed next to the "Calendar View" button. Selecting a type filters the cards displayed in the DOM dynamically, updating based on categories: Hackathons, Programming, Conferences, Congress, Bug Bounties / CTF, Game Jams, Bizcomps.
* **Deep Link Reset Integration:** Navigating directly to a card via a hash link automatically resets the category filter to "All Types", ensuring the targeted card is present in the DOM and accessible for highlighting and scrolling.
* **Row-Wrap Responsiveness:** Styled to stay in a single row alongside the calendar button until a narrow viewport width of `380px` or less, at which point the buttons stack vertically for optimal touch interactions.

---

## 4. Version History & Changelog

### 🚀 v1.7.0 — Event Type Filtering & Registration Deadlines (Current)
* **Features:**
  * **Event Type Metadata & Tags**: Added a `"Type"` field to the JSON schema. Renders a category pill tag (`.raid-type-tag`) at the top of each campaign card.
  * **Registration Deadline Display**: Introduced a `"RegEndDate"` field. Uses a dynamic formatter to display readable deadlines. Compares against system time to display red/gray `(Closed)` tags or green active deadlines inside details drawers.
  * **Custom Dropdown Filter**: Built a custom filter dropdown menu containing preset event categories next to the calendar button. Selecting a type instantly filters visible campaigns.
  * **Narrow Breakpoint Row Wrapping**: Standardized styling so both buttons align on a single row down to a very narrow mobile screen size of `380px`, where they stack vertically.
  * **Routing Resets**: Programmed SPA hash routing to reset active filters to "All Types" whenever deep links (e.g. `#raid-3`) are resolved, preventing target element resolution failures.
  * **Event Notes Section**: Added a new SPA page section (`#notes`) that dynamically queries all event notes listings from `raids.json` and renders interactive cards, linking them to local markdown pages and deep-linking back to their Campaign Roadmap cards.
  * **Same-Tab Note Links**: Configured all local `"notes"` links to open in the same tab so that the back button inside the markdown renderer correctly returns the user to the portal without leaving residual tabs open.

### 🚀 v1.6.0 — Campaign Calendar, Floating Controls & Swipe Boost
* **Features:**
  * **Interactive Campaign Calendar**: Built a month-by-month square calendar view that retrieves event `"startDate"` values. Highlights active days and features previous/next navigation.
  * **Event Overlap Counter**: Renders a badge indicating event counts on days where multiple events start simultaneously (e.g. July 10).
  * **Direct Redirection Overlay**: Implemented a slide-up vertical list overlay within the calendar. Clicking event items automatically redirects the user to the corresponding card layout with highlights.
  * **Body-Root Modal Positioning**: Fixed scroll viewport-centering by positioning the modal at the root level of `<body>`, isolating it from layout translations.
  * **Dedicated Floating Button**: Added an icon-only circular floating calendar button at the viewport corner that is controlled by an `IntersectionObserver` tracking the inline button's scroll state.
  * **Mobile Spacing Optimization**: Compressed card padding (`1.15rem`), grid gaps (`1rem`), and header typography on mobile to fit more cards and reduce vertical scrolling height.
  * **Velo-Boost Scroll Multiplier**: Added flick gesture recognition on touchscreens that adds smooth, velocity-proportional scrolling offsets to enhance mobile traversal speed.

### 🚀 v1.5.0 — Deep Linking, Copy-to-Clipboard Buttons & Highlight Animations
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
