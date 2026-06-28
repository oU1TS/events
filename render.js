/**
         * Markdown Renderer Configuration
         */

        // Configure Marked to use Highlight.js
        marked.setOptions({
            highlight: function (code, lang) {
                const language = hljs.getLanguage(lang) ? lang : 'plaintext';
                return hljs.highlight(code, { language }).value;
            },
            langPrefix: 'hljs language-',
            gfm: true,
            breaks: true
        });

        const contentEl = document.getElementById('content');
        const loaderEl = document.getElementById('loader');
        const fileNameEl = document.getElementById('display-filename');
        const filePathEl = document.getElementById('display-path');

        let currentMarkdownContent = '';
        let currentMarkdownFilename = '';

        /**
         * Converts standard GitHub URL to raw.githubusercontent.com URL
         */
        function convertGitHubUrl(url) {
            try {
                const u = new URL(url);
                if (u.hostname === 'github.com') {
                    const parts = u.pathname.split('/').filter(Boolean);
                    if (parts.length >= 4 && (parts[2] === 'blob' || parts[2] === 'raw')) {
                        const user = parts[0];
                        const repo = parts[1];
                        const branch = parts[3];
                        const rest = parts.slice(4).join('/');
                        return `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${rest}`;
                    }
                }
            } catch (e) {
                // Not a valid URL or other parsing error, return original
            }
            return url;
        }

        /**
         * Fetches and renders the markdown file
         */
        async function loadMarkdown(filePath) {
            if (!filePath) {
                showError("No markdown file specified.", "Specify a file using ?file=path/to/file.md");
                return;
            }

            // Update UI
            loaderEl.style.display = 'flex';
            contentEl.style.display = 'none';
            document.getElementById('download-btn').style.display = 'none';

            let filename = '';
            let rawMarkdown = '';

            if (filePath === 'session') {
                // Read local file from sessionStorage
                rawMarkdown = sessionStorage.getItem('custom_markdown_content') || '';
                filename = sessionStorage.getItem('custom_markdown_filename') || 'local.md';

                if (!rawMarkdown) {
                    showError("No local markdown content found.", "Please upload/drag-and-drop a file first.");
                    return;
                }

                fileNameEl.textContent = filename.replace('.md', '').replaceAll('_', ' ').replaceAll('-', ' ');
                filePathEl.textContent = 'Local File';
                document.title = `${fileNameEl.textContent} | Reader`;
            } else {
                let fetchUrl = filePath;
                if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
                    fetchUrl = convertGitHubUrl(filePath);
                }

                filename = fetchUrl.split('/').pop().split('#')[0].split('?')[0];
                fileNameEl.textContent = filename.replace('.md', '').replaceAll('_', ' ').replaceAll('-', ' ');
                filePathEl.textContent = filePath;
                document.title = `${fileNameEl.textContent} | Reader`;

                try {
                    const response = await fetch(fetchUrl);
                    if (!response.ok) throw new Error(`Failed to load file: ${response.statusText}`);
                    rawMarkdown = await response.text();
                } catch (error) {
                    console.error(error);
                    showError("Could not load the file.", error.message);
                    return;
                }
            }

            try {
                // Replace <<pagebreak>> with a div
                let processedMarkdown = rawMarkdown.replace(/(`+)(?:[\s\S]*?)\1|<<pagebreak>>/g, (match, ticks) => ticks ? match : '\n\n<div class="page-break"></div>\n\n');

                const htmlContent = marked.parse(processedMarkdown);
                const cleanHtml = DOMPurify.sanitize(htmlContent, {
                    DATA_URI_TAGS: ['img']
                });

                contentEl.innerHTML = cleanHtml;

                // Handle links for nested navigation
                handleLinks(filePath);

                // Resolve relative image paths
                handleImages(filePath);

                // Render Math
                renderMath(contentEl);

                // Save current markdown content & filename for download
                currentMarkdownContent = rawMarkdown;
                currentMarkdownFilename = filename;
                document.getElementById('download-btn').style.display = 'flex';

                // Reveal content
                loaderEl.style.display = 'none';
                contentEl.style.display = 'block';

                // Generate Table of Contents
                generateToC();

                window.scrollTo(0, 0);

            } catch (error) {
                console.error(error);
                showError("Could not render the file.", error.message);
            }
        }

        /**
         * Renders LaTeX using KaTeX
         */
        function renderMath(element) {
            renderMathInElement(element, {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false },
                    { left: '\\(', right: '\\)', display: false },
                    { left: '\\[', right: '\\]', display: true }
                ],
                throwOnError: false
            });
        }

        /**
         * Intercepts links to local markdown files
         */
        function handleLinks(currentPath) {
            const links = contentEl.querySelectorAll('a');

            links.forEach(link => {
                const href = link.getAttribute('href');

                // If it's a relative link to an MD file
                if (href && (href.endsWith('.md') || href.includes('.md#')) && !href.startsWith('http')) {
                    if (currentPath === 'session') {
                        // Prevent navigation for local session files
                        link.addEventListener('click', (e) => {
                            e.preventDefault();
                            alert("Relative markdown links cannot be resolved for locally uploaded files.");
                        });
                        return;
                    }

                    link.addEventListener('click', (e) => {
                        e.preventDefault();

                        // Construct the new path relative to the current file's directory
                        let finalPath;
                        if (currentPath.startsWith('http://') || currentPath.startsWith('https://')) {
                            let resolver = new URL(href, currentPath);
                            finalPath = resolver.href;
                        } else {
                            let fileDir = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
                            let resolver = new URL(href, "http://dummy/" + fileDir);
                            finalPath = resolver.pathname.substring(1); // remove leading /
                        }

                        // Update URL and reload
                        const newUrl = new URL(window.location.href);
                        newUrl.searchParams.set('file', finalPath);
                        window.history.pushState({ path: finalPath }, '', newUrl);
                        loadMarkdown(finalPath);
                    });
                }
            });
        }

        /**
         * Resolves relative image paths to be relative to the markdown file's directory
         */
        function handleImages(currentPath) {
            const images = contentEl.querySelectorAll('img');

            images.forEach(img => {
                const src = img.getAttribute('src');

                // If it's a relative image link (not absolute, not data URI)
                if (src && !src.startsWith('http') && !src.startsWith('data:')) {
                    if (currentPath === 'session') {
                        return; // Local uploaded files don't have relative paths resolved
                    }

                    // Construct the new path relative to the current file's directory
                    let finalPath;
                    if (currentPath.startsWith('http://') || currentPath.startsWith('https://')) {
                        let resolver = new URL(src, currentPath);
                        finalPath = resolver.href;
                    } else {
                        let fileDir = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
                        let resolver = new URL(src, "http://dummy/" + fileDir);
                        finalPath = resolver.pathname.substring(1); // remove leading /
                    }

                    img.setAttribute('src', finalPath);
                }
            });
        }

        function showError(title, message) {
            loaderEl.style.display = 'none';
            contentEl.innerHTML = `
                <div class="error-container">
                    <i class="fa-solid fa-circle-exclamation error-icon"></i>
                    <h2>${title}</h2>
                    <p>${message}</p>
                    <br>
                    <a href="javascript:history.back()" style="color: var(--accent-color); text-decoration: none; font-weight: 600;">
                        <i class="fa-solid fa-arrow-left"></i> Go Back
                    </a>
                </div>
            `;
            contentEl.style.display = 'block';
            fileNameEl.textContent = "Error";

            // Hide ToC toggle on error
            document.getElementById('toc-toggle').style.display = 'none';
        }

        /**
         * Sidebar & Table of Contents Logic
         */
        const navPane = document.getElementById('nav-pane');
        const navOverlay = document.getElementById('nav-overlay');
        const tocToggle = document.getElementById('toc-toggle');
        const closeNav = document.getElementById('close-nav');

        function toggleSidebar() {
            const isOpen = navPane.classList.toggle('open');
            navOverlay.classList.toggle('open', isOpen);
            document.body.style.overflow = isOpen ? 'hidden' : '';
        }

        function closeSidebar() {
            navPane.classList.remove('open');
            navOverlay.classList.remove('open');
            document.body.style.overflow = '';
        }

        tocToggle.addEventListener('click', toggleSidebar);
        closeNav.addEventListener('click', closeSidebar);
        navOverlay.addEventListener('click', closeSidebar);

        function generateToC() {
            const headings = contentEl.querySelectorAll('h1, h2, h3, h4');
            const tocList = document.getElementById('toc-list');
            tocList.innerHTML = '';

            // Show/hide toggle based on headings availability
            tocToggle.style.display = headings.length > 0 ? 'flex' : 'none';

            headings.forEach((heading, index) => {
                // Ensure unique ID for anchor
                if (!heading.id) {
                    heading.id = 'sec-' + index;
                }

                const link = document.createElement('a');
                link.href = '#' + heading.id;
                link.className = `toc-link ${heading.tagName.toLowerCase()}`;

                // Clean text (remove math markers if any, though browser handles this ok usually)
                link.textContent = heading.textContent;

                link.addEventListener('click', (e) => {
                    e.preventDefault();

                    // Account for sticky header height
                    const headerHeight = document.querySelector('header').offsetHeight;
                    const targetPos = heading.getBoundingClientRect().top + window.pageYOffset - headerHeight - 20;

                    window.scrollTo({
                        top: targetPos,
                        behavior: 'smooth'
                    });

                    closeSidebar();
                });

                tocList.appendChild(link);
            });
        }

        // Download function
        document.getElementById('download-btn').addEventListener('click', () => {
            if (!currentMarkdownContent) return;
            const blob = new Blob([currentMarkdownContent], { type: 'text/markdown;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = currentMarkdownFilename || 'document.md';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });

        // Theme Sync with Main Website
        function syncTheme() {
            const storedTheme = localStorage.getItem('theme');
            if (storedTheme === 'light') {
                document.body.classList.add('light-theme');
            } else {
                document.body.classList.remove('light-theme');
            }
        }

        // Initial Load
        syncTheme();
        window.addEventListener('popstate', () => {
            const urlParams = new URLSearchParams(window.location.search);
            loadMarkdown(urlParams.get('file'));
        });

        const urlParams = new URLSearchParams(window.location.search);
        loadMarkdown(urlParams.get('file'));
