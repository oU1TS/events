# Session 18 — Conversation Archive (Continued)

> This file is appended per turn. Secrets are redacted per AGENTS.md policy.

---

## Turn (2026-11-26): Slug Deep Link No-Expand & Anti-Flicker Audit

### 👤 User

> look into the records @[d:\GitHub\[oU1TS]\events\doc\prompts] and verify that the feature "when the user uses the website URL with the slug of a certain raid card, it takes them to that card and shows a faint glow around it to highlight it" works properly. no need to expand the cards to highlight it. Just make sure it does not flicker when the website is redirecting the user to the raid card position.

### 🤖 Assistant Response

Audited the slug deep link feature by cross-referencing prompt history (sessions 17, 18.3–18.6) against the live code in `app.js` and `style.css`.

**Three regressions found and fixed:**

#### 1. Cards were force-expanded on deep link navigation

Both `scrollToRaid()` and `renderRaids()` contained code that opened the `<details>` card when arriving via `#raid-N` URL. Removed:
- The `card.open = true` block from `scrollToRaid()` (along with the now-unused `isProgrammaticScrollOpening` toggle)
- The `isTargetedRaid` branch from `renderRaids()` initial render path

Cards now stay in their natural collapsed/expanded state; slug URLs only scroll and glow.

#### 2. `transition: none !important` dropped from `.raid-card.highlighted` (CSS)

First added in session 18.3 to prevent the base `.raid-card` transition (`border-color`, `box-shadow`, `transform`) from competing with `@keyframes highlightPulse` on initial frames. It was no longer in the current `style.css`. **Restored.**

#### 3. GPU compositing hints also missing (`will-change`, `backface-visibility`)

Also from session 18.3. `will-change: box-shadow` promotes the card to its own compositing layer; `backface-visibility: hidden` ensures paint happens on the compositor thread rather than the main thread. **Restored.**

**Syntax check:** `node -c app.js` → Exit 0, clean.

---

**Files changed:**
- [`app.js`](file:///d:/GitHub/[oU1TS]/events/app.js) — removed force-open in `scrollToRaid()` and `renderRaids()`
- [`style.css`](file:///d:/GitHub/[oU1TS]/events/style.css) — restored `transition: none`, `will-change`, `backface-visibility` on `.raid-card.highlighted`

**Archived:**
- [`18.9 Implementation Plan - Slug Deep Link No-Expand & Anti-Flicker Hardening.md`](file:///d:/GitHub/[oU1TS]/events/doc/prompts/18.9%20Implementation%20Plan%20-%20Slug%20Deep%20Link%20No-Expand%20%26%20Anti-Flicker%20Hardening.md)
- [`18.10 Walkthrough - Slug Deep Link No-Expand & Anti-Flicker Hardening.md`](file:///d:/GitHub/[oU1TS]/events/doc/prompts/18.10%20Walkthrough%20-%20Slug%20Deep%20Link%20No-Expand%20%26%20Anti-Flicker%20Hardening.md)
