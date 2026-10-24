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
- **Automatic Full Conversation Archiving**:
  - After chat prompt-response cycles, maintain and update the session's comprehensive conversation archive in [`doc/prompts/<Prefix>. <Session Title>.md`](doc/prompts/) by appending new turn contents to it.
  - **DO NOT** create a new file for each individual prompt turn within the same session (avoid creating fragmented files like `<Prefix>.3`, `<Prefix>.4`, `<Prefix>.5`, etc.).
  - Append the turn's verbatim user request, reasoning process (`### Thinking`), and final response (`### AI Response`) directly to the session archive file, separated by horizontal rules (`---`).
  - Keep conversation records intact with high fidelity so that complete context and design rationale are preserved across the project lifecycle.
- **Mandatory Secret Redaction & Placeholder Replacement**:
  - **Zero Secrets in Archives & Docs**: Whenever API keys, database passwords, JWT tokens (such as Supabase `anon` or `service_role` keys), OAuth secrets, or personal access tokens appear in user requests, internal reasoning, code diffs, or responses, you MUST sanitize them by replacing them with descriptive placeholders (e.g., `<YOUR_SUPABASE_URL>`, `<YOUR_SUPABASE_ANON_KEY>`, `[REDACTED_SECRET]`).
  - Never allow raw secrets, keys, or sensitive credentials to be stored or committed in `doc/prompts/`, documentation, or any markdown files.
- **Session Continuity & Updating Past Archives**:
  - Whenever an existing conversation or chat thread is continued, resumed, or revisited, locate and update the corresponding existing archive in `doc/prompts/<Prefix>. <Session Title>.md` by appending the new turns directly to it.
  - **DO NOT** create a new major sequence number or split an ongoing dialogue across multiple files when resuming or updating an existing chat.
  - If a past archive file missed earlier turns from the current conversation, retroactively synchronize and append missing turns so that the file contains the complete, uninterrupted history.
- **Fractional Suffixes Reserved for Plans & Walkthroughs Only**:
  - Minor/fractional prefixes (e.g., `<Prefix>.1`, `<Prefix>.2`, etc.) are reserved **exclusively** for companion implementation plans and walkthroughs:
    - Primary chat session: `doc/prompts/<Prefix>. <Session Title>.md` (contains turns sequentially)
    - Implementation plan: `doc/prompts/<Prefix>.1 Implementation Plan - <Plan Title>.md`
    - Walkthrough document: `doc/prompts/<Prefix>.2 Walkthrough - <Title>.md`
    - Subsequent plans/walkthroughs within the same session: `<Prefix>.3 Implementation Plan - ...`, `<Prefix>.4 Walkthrough - ...`, etc.
- **Mandatory Dual-Write on Every Turn**:
  - **Implementation Plans**: Whenever creating or updating an implementation plan artifact (`implementation_plan.md`), simultaneously write a copy to `doc/prompts/<Prefix>.<N> Implementation Plan - <Plan Title>.md` before pausing for user review.
  - **Walkthroughs**: Whenever creating or updating a walkthrough artifact (`walkthrough.md`), simultaneously write a copy to `doc/prompts/<Prefix>.<N> Walkthrough - <Title>.md` upon completing execution.
  - **Full Conversation Archive**: Update and append the active turn to `doc/prompts/<Prefix>. <Session Title>.md` immediately upon generating the response.
- **Target Location**: All prompt, plan, and walkthrough records reside in the [`doc/prompts`](doc/prompts) directory.
- **Prefix Sequencing Strategy**:
  - Inspect existing files in `doc/prompts/` to identify the current major sequence integer (e.g., `1.`, `2.`, ..., `12.`, `13.`, etc.).
  - Increment the sequence integer ONLY when starting an entirely distinct, new conversation session that does not belong to a pre-existing thread.
  - Keep all conversation turns for that session inside the main file `doc/prompts/<Prefix>. <Session Title>.md`.
- **Chat Archive Fidelity & Sanitization**:
  - Reproduce the conversation clearly (user request blocks verbatim, with sensitive keys redacted).
  - Include the thinking/reasoning process (`### Thinking`) alongside the final response (`### AI Response`).
  - Verify that all API keys and secrets have been replaced with placeholders before writing.
  - Preserve frontmatter tags comments (e.g., `<!-- Frontmatter Tags: ... -->`) at the top of the archive file.

## 3. Code Quality & Styling Standards
- Follow established vanilla JavaScript and CSS conventions across the repository (`index.html`, `style.css`, `app.js`).
- Avoid introducing unnecessary third-party runtime frameworks or heavy libraries unless explicitly requested.
- Maintain responsive design, glassmorphism, smooth animations, and dark/light theme consistency across all interactive modules, cards, and modal components.

## 4. Commit Message & Chat Summary Generation
- **Commit Message & Description Suggestion**:
  - At the end of responses completing substantial work, summarize the work completed across the chat session (referencing the active prompt archive in `doc/prompts/<Prefix>. <Session Title>.md`).
  - Suggest a ready-to-use Git commit message with a structured commit description at the very end of the response.
