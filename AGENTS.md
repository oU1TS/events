# Repository Rules & Guidelines

## 1. Documentation & Learning Maintenance
- **Automatic Documentation Updates**: Whenever adding new features, fixing bugs, refactoring components, or altering UI/styles in this codebase:
  1. Keep [`documentation.md`](documentation.md) and [`learning.md`](learning.md) synchronized with feature and release states.
  2. Keep [`README.md`](README.md) updated with setup, architecture, and current capabilities.
- **Documentation Maintenance Cadence (`README.md`, `documentation.md`, `learning.md`)**:
  - Keep project documentation synchronized with the project's evolving features, database integrations, and deployment setup.
  - **Major Update Trigger**: Update full project documentations (`documentation.md`, `learning.md`, `README.md`) when major architectural features or sub-systems are landed (such as database schemas, auth workflows, new dashboards, proposal mechanisms, or syndication feeds).
  - Add version entries to the Changelog in [`documentation.md`](documentation.md) and record UX impact mappings in [`learning.md`](learning.md).

## 2. Mandatory Prompt, Plan & Walkthrough Archiving
- **Target Location & Serial Session Folders**:
  - All conversation, prompt, plan, and walkthrough records reside inside [`doc/prompts/`](doc/prompts) in dedicated serial folders named with an incrementing major integer prefix:
    `doc/prompts/<N>. <Session Title>/` (e.g., `doc/prompts/14. Event Registration Modal/`).
  - **Determining `<N>`**: Inspect `doc/prompts/` to find the highest existing major integer prefix across both existing session folders and legacy flat `<N>. ...md` files, and assign `N = N_max + 1` for an entirely distinct, new conversation session.
  - **Session Continuity**: Whenever an existing conversation or chat thread is continued, resumed, or revisited, locate and update **that same session folder** (`doc/prompts/<N>. <Session Title>/`); do NOT create a new major folder `<N+1>` per turn.
- **Required Files Inside `doc/prompts/<N>. <Session Title>/`**:
  1. **`transcript_full.jsonl`**: An exact UTF-8 copy of `<appDataDir>/brain/<conversation-id>/.system_generated/logs/transcript_full.jsonl`. Never truncate or reformat lines (except redacting raw secrets if any appear before committing).
  2. **`conversation.md` (Full Authentic Chat Archive)**: A complete Markdown rendering that **looks exactly the same as the AI response in the chat interface, alongside the user prompts**. It structures turns sequentially (`## Turn <N>`) with `### 👤 User` (verbatim prompt, secrets redacted), `### 🧠 AI Thinking` (collapsible reasoning `<details><summary>Click to expand internal reasoning</summary>...</details>`), and `### 🤖 Assistant Response` (exact full response with all markdown headings, code, and explanations verbatim). Do NOT replace or truncate with high-level synthetic summaries (such as the legacy `summary.md` format).
  3. **Companion Plans & Walkthroughs (Fractional Suffixes Reserved for Plans & Walkthroughs Only)**: Stored in the same `doc/prompts/<N>. <Session Title>/` folder:
     - Implementation plan: `<N>.1 Implementation Plan - <Plan Title>.md` (dual-write whenever creating/updating `implementation_plan.md` before user review)
     - Walkthrough document: `<N>.2 Walkthrough - <Title>.md` (dual-write whenever creating/updating `walkthrough.md` upon completion)
     - Subsequent plans/walkthroughs in the same session: `<N>.3 Implementation Plan - ...`, `<N>.4 Walkthrough - ...`, etc.
- **Mandatory Secret Redaction & Placeholder Replacement**:
  - **Zero Secrets in Archives & Docs**: Whenever API keys, database passwords, JWT tokens (such as Supabase `anon` or `service_role` keys), OAuth secrets, or personal access tokens appear in user requests, internal reasoning, code diffs, or responses, you MUST sanitize them by replacing them with descriptive placeholders (e.g., `<YOUR_SUPABASE_URL>`, `<YOUR_SUPABASE_ANON_KEY>`, `[REDACTED_SECRET]`).
  - Never allow raw secrets, keys, or sensitive credentials to be stored or committed in `doc/prompts/`, documentation, or any markdown files.
- **Update Cadence (Keeping the Archive Current)**:
  - Because the runtime writes a turn's final `PLANNER_RESPONSE` (final `thinking` and `content`) to `transcript_full.jsonl` after the turn finishes:
    1. **At the start of each turn (or when continuing from a prior `<conversation-id>`):** Copy `<appDataDir>/brain/<conversation-id>/.system_generated/logs/transcript_full.jsonl` to `doc/prompts/<N>. <Session Title>/transcript_full.jsonl` and regenerate `conversation.md` (with secrets redacted) so the previous turn's finalized `thinking` and `content` are captured verbatim (and sync the prior conversation's folder if continuing).
    2. **Before sending each new final response:** Re-copy `transcript_full.jsonl`, regenerate `conversation.md` (with secrets redacted) to capture all completed steps of the current turn, append the exact final response under `### 🤖 Assistant Response (Pre-Commit)` (noting it will be replaced verbatim from `transcript_full.jsonl` on the next sync).

## 3. Code Quality & Styling Standards
- Follow established vanilla JavaScript and CSS conventions across the repository (`index.html`, `style.css`, `app.js`).
- Avoid introducing unnecessary third-party runtime frameworks or heavy libraries unless explicitly requested.
- Maintain responsive design, glassmorphism, smooth animations, and dark/light theme consistency across all interactive modules, cards, and modal components.

## 4. Commit Message & Chat Summary Generation
- **Commit Message & Description Suggestion**:
  - At the end of responses completing substantial work, summarize the work completed across the chat session (referencing the active session folder in `doc/prompts/<N>. <Session Title>/`).
  - Suggest a ready-to-use Git commit message with a structured commit description at the very end of the response.
