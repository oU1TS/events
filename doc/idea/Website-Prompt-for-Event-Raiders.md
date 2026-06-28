> From: https://gemini.google.com/app/40076a7e816c1ada

# you asked

message time: 2026-06-28 16:29:50

// set the chat name "PROJECT | UITS Event Raiders

# task

help me brainstorm, and write a detailed prompt for the following idea.

# idea

I want to build an website, primarily for the facebook page https://tinyurl.com/bdhsf7b4 to explain the users of an initiative "UITS Event Raiders"

# about the initiative

the purpose is to share news about events and to gather the interested persons to go together in those events. 

# about the website

the website should be a simple single page website with changing sections when the user clicks on the navigation tabs (SPA). The tech should be raw HTML, CSS, JS. The home page will show the title and the core purpose of the initiative. And just below 2 buttons will show: "View Past Raids" and "Join Us"

"View Past Raids" page section:
- will show a detailed record of the past events, their dates (Range, date of each sub-event), registration fees, important links, details, venues etc. 
- these data should load from another file (JS or JSON) and not be purely written in html codes. 
- whatever file (JS or JSON) is used, the text should support <br> tags or some way to add linebreaks to write multi-line texts

 "Join Us" page section:
- will show a step-by-step guide to join our WhatsApp group
- the steps would be to provide the maintainer (link to some social profiles) with their Student ID photo and references from one of the club members (so it proves that they are actual students that the club is aware of)
- after proving their identity, the maintainer will share their phone number, and the interested person should add that to their contacts. The reason is that WhatsApp allows sharing "Chat History" to only the mutual contacts upon adding them to the group

# the "Learn More" section:
- there should be another section, accessible only through the navigation tabs where more related links will be kept
- the primary link will be the link to https://ou1ts.netlify.app/ (oU1TS Community Project) where the visitors can learn more about the people behind this initiative

# theme
- use simple solid color themes
- dark mode and light mode toggles
- dark mode should be black and white colors, and white mode should be blue, green and white colors.

---

# gemini response

## 🧠 Brainstorming & Enhancements

Before diving into the system prompt, here are a few structural and technical recommendations to make this single-page application (SPA) robust, maintainable, and highly functional while keeping to raw HTML/CSS/JS:

### 1. Architecture & State Management
* **Routing without Frameworks:** Since it’s an SPA using raw JS, we can use the `hashchange` event (`window.location.hash`) or a simple data-attribute state switcher (`data-target="home"`). The hash method (`#home`, `#past-raids`, `#join`) is highly recommended because it allows users to bookmark specific sections or use the browser's back button naturally.
* **Data Injection:** Using a separate `raids.json` file fetched via `fetch()` is cleaner than a JS object variable, as it strictly separates data from logic. To support line breaks without raw HTML vulnerabilities, we can use standard JSON string escapes (`\n`) and handle them via CSS (`white-space: pre-line`) instead of letting arbitrary `<br>` tags parse, which guards against Cross-Site Scripting (XSS).

### 2. UI/UX Suggestions
* **The "Raid" Aesthetic:** Since it’s named "Event Raiders," a clean, slightly gamified modern look fits well. 
* **Theme Continuity:** The CSS should utilize native **CSS Custom Properties (Variables)**. This makes the dark/light mode toggle as simple as swapping a class on the `<body>` element (e.g., `document.body.classList.toggle('light-theme')`).
* **Privacy Guardrail:** For the "Join Us" section, explicitly add a small privacy disclaimer stating that Student ID photos are exclusively used for verification and are immediately discarded.

---

## 📝 The Master Prompt

Copy and paste the detailed prompt below into your AI code generator (like ChatGPT, Claude, or Cursor) to build the website exactly as envisioned.

```text
Act as an expert frontend web developer. Create a clean, modern, and highly responsive Single Page Application (SPA) utilizing only raw HTML5, CSS3, and vanilla JavaScript (ES6+). 

The project is for an initiative named "UITS Event Raiders". The core initiative shares news about events and gathers interested students to attend them together.

### Technical & Architectural Requirements
1. Single Page Application (SPA): Implement navigation switching via tabs without refreshing the page. Use clean visibility toggles or a URL hash router (#home, #past-raids, #join, #learn-more).
2. Data Separation: Past raids must NOT be hardcoded in HTML. Store past raid details in a separate 'raids.json' file and fetch it asynchronously via JS. 
3. Multi-line Text Handling: Ensure description fields in the JSON support line breaks (use "\n" in JSON and handle it via CSS 'white-space: pre-line', or carefully parse breaks) so text displays across multiple paragraphs cleanly.
4. Themes (Light/Dark): Implement a theme toggle switch. Use CSS variables to manage colors:
   - Dark Mode: Minimalist black and white palette.
   - Light Mode: A vibrant palette featuring blues, greens, and white.

### Page Structure & Sections

#### 1. Header/Navigation
- Minimalist navbar featuring the title "UITS Event Raiders" (linking to the facebook page: https://tinyurl.com/bdhsf7b4).
- Nav links: Home, Past Raids, Join Us, Learn More.
- A prominent, stylized toggle switch for Dark/Light mode.

#### 2. Home Section (Default View)
- A striking hero area displaying the initiative's title and its core purpose: "Sharing event news and raiding events together."
- Directly beneath the hero text, place two clear call-to-action (CTA) buttons: 
  - "View Past Raids" (switches view to Past Raids)
  - "Join Us" (switches view to Join Us)

#### 3. "View Past Raids" Section
- Dynamically renders cards or a timeline grid from the fetched JSON file.
- Each raid item should beautifully display: Title, Date Range (including specific dates for sub-events), Registration Fees, Venue, Important Links, and a Detailed Description.

#### 4. "Join Us" Section
- A clean, step-by-step visual onboarding guide to join the WhatsApp group.
- Step 1: Reach out to a maintainer (provide clear placeholder links for social profiles).
- Step 2: Provide a photo of your Student ID alongside a reference name/ID from an existing club member to prove you are an active student recognized by the community.
- Step 3: Once identity is verified, save the maintainer's phone number to your contacts. (Include an explanatory note: WhatsApp only synchronizes and shares full group "Chat History" to mutual contacts upon adding them to a group).
- Include a small, professional privacy note stating student data is securely handled and deleted post-verification.

#### 5. "Learn More" Section
- Accessible strictly via the navigation menu.
- Hosts an curated index of external links.
- The primary highlight must be a card linking to the oU1TS Community Project (https://ou1ts.netlify.app/) where users can learn about the masterminds behind this initiative.

### Design Style & Requirements
- Mobile-first approach, fully responsive using Flexbox and CSS Grid.
- Smooth transitions when toggling themes or switching navigation views.
- Clean typography and ample white space.
- Write highly modular, documented, and clean code. Deliver the code across three separate files: 'index.html', 'style.css', 'app.js', and a sample 'raids.json'.
```

***

## 📂 Structural Blueprint (Bonus Reference)

To give you a quick head start on how your data and styling variables should look, here are the core snippets for your local environment:

### `raids.json` Example
```json
[
  {
    "title": "National Tech Fest 2026",
    "dateRange": "July 12 - July 14, 2026",
    "subEvents": "Day 1: Hackathon\nDay 2: Line Following Robot\nDay 3: Project Showcasing",
    "fee": "500 BDT per team",
    "venue": "UITS Permanent Campus Auditorium",
    "links": {
      "Registration": "https://example.com/register",
      "Rulebook": "https://example.com/rules"
    },
    "details": "We are assembling a massive group to raid this year's Tech Fest!\nWhether you are competing or just going as a visitor to support our teams, join our squad so we can book transport and seats together."
  }
]
```

### CSS Variables Setup (`style.css`)
```css
:root {
  /* Dark Mode Default */
  --bg-color: #0b0c10;
  --text-color: #ffffff;
  --accent-color: #c5a880; /* Gold/Silver touch for premium look */
  --card-bg: #1f2833;
}

body.light-theme {
  /* Light Mode Switch */
  --bg-color: #f4f7f6;
  --text-color: #1a202c;
  --accent-color: #2b6cb0; /* Deep blue */
  --card-bg: #ffffff;
  /* You can introduce your green hues here for buttons or highlights */
  --success-color: #48bb78; 
}

.raid-details {
  white-space: pre-line; /* This magical property respects your \n from JSON! */
}
```