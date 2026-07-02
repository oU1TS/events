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

        // Search feature state
        let docSentences = [];
        let isSearchOpen = false;
        let isPaginationMode = false;
        let searchQuery = '';
        let searchResults = [];
        let currentMatchIndex = -1;
        let currentDocumentTags = [];

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
            resetSearch();

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

                // Index document and show search button
                indexDocument();
                currentDocumentTags = parseTags(rawMarkdown);
                const searchToggle = document.getElementById('floating-search-toggle');
                if (searchToggle) searchToggle.style.display = 'flex';

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

            // Hide search button and close search on error
            const searchToggle = document.getElementById('floating-search-toggle');
            if (searchToggle) searchToggle.style.display = 'none';
            closeSearch();
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

        // Reset search function to clear state
        function resetSearch() {
            isPaginationMode = false;
            isSearchOpen = false;
            searchQuery = '';
            searchResults = [];
            currentMatchIndex = -1;
            currentDocumentTags = [];
            
            const searchContainer = document.getElementById('search-container');
            if (searchContainer) {
                searchContainer.classList.add('search-container-hidden');
                searchContainer.classList.remove('pagination-mode');
            }
            
            const toggleBtn = document.getElementById('floating-search-toggle');
            if (toggleBtn) {
                toggleBtn.classList.remove('active');
            }
            
            const searchInput = document.getElementById('search-input');
            if (searchInput) {
                searchInput.value = '';
            }
            
            const clearBtn = document.getElementById('search-clear-btn');
            if (clearBtn) {
                clearBtn.style.display = 'none';
            }
            
            const resultsList = document.getElementById('search-results-list');
            if (resultsList) {
                resultsList.innerHTML = '';
            }

            const tagsContainer = document.getElementById('search-tags-container');
            if (tagsContainer) {
                tagsContainer.style.display = 'none';
            }

            const tagsList = document.getElementById('search-tags-list');
            if (tagsList) {
                tagsList.innerHTML = '';
            }
            
            const prevBtn = document.getElementById('search-prev-btn');
            const nextBtn = document.getElementById('search-next-btn');
            if (prevBtn) prevBtn.disabled = true;
            if (nextBtn) nextBtn.disabled = true;
            
            const listBtn = document.getElementById('search-list-btn');
            if (listBtn) listBtn.style.display = 'none';
            
            removeHighlights();
        }

        /**
         * Floating Search and Pagination Feature
         */

        function indexDocument() {
            docSentences = [];
            const textElements = findTextElements(contentEl);
            let sentenceIndex = 0;
            
            textElements.forEach(el => {
                const text = getCleanText(el);
                const sentences = splitIntoSentences(text);
                sentences.forEach(s => {
                    docSentences.push({
                        text: s,
                        element: el,
                        index: sentenceIndex++
                    });
                });
            });
        }

        function findTextElements(node, list = []) {
            if (!node) return list;
            
            // Skip code blocks, math blocks, scripts, styles, page breaks
            if (node.tagName === 'PRE' || node.tagName === 'CODE' || 
                node.classList?.contains('katex') || node.classList?.contains('katex-display') ||
                node.tagName === 'SCRIPT' || node.tagName === 'STYLE' ||
                node.classList?.contains('page-break')) {
                return list;
            }
            
            const searchableTags = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TD', 'TH', 'BLOCKQUOTE', 'FIGCAPTION', 'LI'];
            
            // If it's a searchable tag, index it and do not recurse into its children
            let hasSearchableChild = false;
            for (let i = 0; i < node.children.length; i++) {
                const child = node.children[i];
                if (searchableTags.includes(child.tagName) || child.querySelector(searchableTags.join(','))) {
                    hasSearchableChild = true;
                    break;
                }
            }
            
            if (searchableTags.includes(node.tagName) && !hasSearchableChild) {
                list.push(node);
            } else {
                for (let i = 0; i < node.children.length; i++) {
                    findTextElements(node.children[i], list);
                }
            }
            return list;
        }

        function getCleanText(el) {
            const clone = el.cloneNode(true);
            const unwanted = clone.querySelectorAll('pre, code, .katex, style, script, .page-break');
            unwanted.forEach(node => node.remove());
            return clone.textContent;
        }

        function splitIntoSentences(text) {
            if (!text) return [];
            const cleanText = text.replace(/\s+/g, ' ').trim();
            if (!cleanText) return [];
            
            const regex = /[^.!?]+(?:[.!?]+|$)/g;
            const sentences = [];
            let match;
            while ((match = regex.exec(cleanText)) !== null) {
                const sentence = match[0].trim();
                if (sentence.length > 3) { // ignore very short text snippets
                    sentences.push(sentence);
                }
            }
            return sentences;
        }

        function parseTags(markdown) {
            if (!markdown) return [];
            const regex = /<!--[\s\S]*?tags:\s*([^\r\n\--->]+)[\s\S]*?-->/i;
            const match = markdown.match(regex);
            if (match) {
                return match[1].split(',').map(t => t.trim()).filter(Boolean);
            }
            return [];
        }

        function renderTags() {
            const tagsContainer = document.getElementById('search-tags-container');
            const tagsList = document.getElementById('search-tags-list');
            if (!tagsContainer || !tagsList) return;
            
            if (currentDocumentTags.length > 0) {
                tagsList.innerHTML = '';
                currentDocumentTags.forEach(tag => {
                    const pill = document.createElement('span');
                    pill.className = 'search-tag-pill';
                    pill.textContent = tag;
                    pill.addEventListener('click', () => {
                        const searchInput = document.getElementById('search-input');
                        if (searchInput) {
                            searchInput.value = tag;
                            performSearch();
                            searchInput.focus();
                        }
                    });
                    tagsList.appendChild(pill);
                });
                tagsContainer.style.display = 'block';
            } else {
                tagsContainer.style.display = 'none';
            }
        }

        function escapeHTML(str) {
            return str.replace(/[&<>'"]/g, 
                tag => ({
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    "'": '&#39;',
                    '"': '&quot;'
                }[tag] || tag)
            );
        }

        function escapeRegExp(string) {
            return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        function removeHighlights() {
            const highlights = contentEl.querySelectorAll('mark.search-match');
            highlights.forEach(mark => {
                const textNode = document.createTextNode(mark.textContent);
                mark.parentNode.replaceChild(textNode, mark);
            });
            contentEl.normalize();
        }

        function highlightQuery(query) {
            removeHighlights();
            if (!query) return;
            
            const regex = new RegExp(escapeRegExp(query), 'gi');
            const textNodes = [];
            
            function findTextNodes(node) {
                if (node.nodeType === Node.TEXT_NODE) {
                    if (node.textContent.trim().length > 0) {
                        textNodes.push(node);
                    }
                } else {
                    const skipTags = ['PRE', 'CODE', 'SCRIPT', 'STYLE'];
                    if (skipTags.includes(node.tagName) || node.classList?.contains('katex') || node.classList?.contains('page-break')) {
                        return;
                    }
                    for (let child of node.childNodes) {
                        findTextNodes(child);
                    }
                }
            }
            
            const textElements = findTextElements(contentEl);
            textElements.forEach(el => {
                for (let child of el.childNodes) {
                    findTextNodes(child);
                }
            });
            
            for (let i = textNodes.length - 1; i >= 0; i--) {
                const node = textNodes[i];
                const text = node.textContent;
                let match;
                regex.lastIndex = 0;
                
                const parent = node.parentNode;
                if (!parent) continue;
                
                const matches = [];
                while ((match = regex.exec(text)) !== null) {
                    matches.push({
                        start: match.index,
                        end: regex.lastIndex,
                        matchText: match[0]
                    });
                }
                
                if (matches.length > 0) {
                    const fragment = document.createDocumentFragment();
                    let lastIndex = 0;
                    
                    matches.forEach(m => {
                        if (m.start > lastIndex) {
                            fragment.appendChild(document.createTextNode(text.substring(lastIndex, m.start)));
                        }
                        const mark = document.createElement('mark');
                        mark.className = 'search-match';
                        mark.textContent = m.matchText;
                        fragment.appendChild(mark);
                        lastIndex = m.end;
                    });
                    
                    if (lastIndex < text.length) {
                        fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
                    }
                    
                    parent.replaceChild(fragment, node);
                }
            }
        }

        function updatePaginationHighlights() {
            highlightQuery(searchQuery);
            const marks = contentEl.querySelectorAll('mark.search-match');
            const prevBtn = document.getElementById('search-prev-btn');
            const nextBtn = document.getElementById('search-next-btn');
            
            if (marks.length > 0) {
                if (prevBtn) prevBtn.disabled = false;
                if (nextBtn) nextBtn.disabled = false;
                
                if (currentMatchIndex < 0 || currentMatchIndex >= marks.length) {
                    currentMatchIndex = 0;
                }
                scrollToActiveMatch(marks);
            } else {
                if (prevBtn) prevBtn.disabled = true;
                if (nextBtn) nextBtn.disabled = true;
                currentMatchIndex = -1;
            }
        }

        function scrollToActiveMatch(marks) {
            if (!marks || marks.length === 0) return;
            
            marks.forEach(m => m.classList.remove('search-match-active'));
            
            if (currentMatchIndex < 0) currentMatchIndex = 0;
            if (currentMatchIndex >= marks.length) currentMatchIndex = marks.length - 1;
            
            const activeMark = marks[currentMatchIndex];
            if (activeMark) {
                activeMark.classList.add('search-match-active');
                
                const headerHeight = document.querySelector('header').offsetHeight;
                const rect = activeMark.getBoundingClientRect();
                const absoluteTop = window.pageYOffset + rect.top;
                const targetScroll = absoluteTop - headerHeight - 60;
                
                window.scrollTo({
                    top: targetScroll,
                    behavior: 'smooth'
                });
            }
        }

        function navigateMatch(direction) {
            const marks = contentEl.querySelectorAll('mark.search-match');
            if (marks.length === 0) return;
            
            currentMatchIndex += direction;
            if (currentMatchIndex < 0) {
                currentMatchIndex = marks.length - 1;
            } else if (currentMatchIndex >= marks.length) {
                currentMatchIndex = 0;
            }
            scrollToActiveMatch(marks);
        }

        function enterPaginationMode() {
            if (!searchQuery) return;
            isPaginationMode = true;
            document.getElementById('search-container').classList.add('pagination-mode');
            document.getElementById('search-list-btn').style.display = 'flex';
            updatePaginationHighlights();
        }

        function exitPaginationMode() {
            isPaginationMode = false;
            document.getElementById('search-container').classList.remove('pagination-mode');
            document.getElementById('search-list-btn').style.display = 'none';
            removeHighlights();
            currentMatchIndex = -1;
        }

        function openSearch() {
            isSearchOpen = true;
            document.getElementById('search-container').classList.remove('search-container-hidden');
            document.getElementById('floating-search-toggle').classList.add('active');
            
            // Sync search state UI
            performSearch();
            
            setTimeout(() => {
                document.getElementById('search-input').focus();
            }, 100);
            
            if (isPaginationMode && searchQuery) {
                updatePaginationHighlights();
            }
        }

        function closeSearch() {
            isSearchOpen = false;
            document.getElementById('search-container').classList.add('search-container-hidden');
            document.getElementById('floating-search-toggle').classList.remove('active');
            removeHighlights();
        }

        function toggleSearch() {
            if (isSearchOpen) {
                closeSearch();
            } else {
                openSearch();
            }
        }

        function performSearch() {
            const inputVal = document.getElementById('search-input').value;
            searchQuery = inputVal.trim();
            
            const clearBtn = document.getElementById('search-clear-btn');
            const resultsList = document.getElementById('search-results-list');
            const prevBtn = document.getElementById('search-prev-btn');
            const nextBtn = document.getElementById('search-next-btn');
            const tagsContainer = document.getElementById('search-tags-container');
            
            if (!searchQuery) {
                clearBtn.style.display = 'none';
                prevBtn.disabled = true;
                nextBtn.disabled = true;
                
                // Show tag suggestions if available, otherwise show standard placeholder
                if (currentDocumentTags.length > 0) {
                    renderTags();
                    resultsList.innerHTML = '';
                } else {
                    if (tagsContainer) tagsContainer.style.display = 'none';
                    resultsList.innerHTML = '<div class="search-no-results">Type to search sentences...</div>';
                }
                
                if (isPaginationMode) {
                    removeHighlights();
                    currentMatchIndex = -1;
                }
                return;
            }
            
            if (tagsContainer) tagsContainer.style.display = 'none';
            clearBtn.style.display = 'flex';
            
            const queryLower = searchQuery.toLowerCase();
            searchResults = docSentences.filter(s => s.text.toLowerCase().includes(queryLower));
            
            resultsList.innerHTML = '';
            
            if (searchResults.length === 0) {
                prevBtn.disabled = true;
                nextBtn.disabled = true;
                resultsList.innerHTML = '<div class="search-no-results">No matching sentences found.</div>';
                if (isPaginationMode) {
                    removeHighlights();
                    currentMatchIndex = -1;
                }
            } else {
                prevBtn.disabled = false;
                nextBtn.disabled = false;
                
                const escapedQuery = escapeRegExp(searchQuery);
                const regex = new RegExp(`(${escapedQuery})`, 'gi');
                
                searchResults.forEach(match => {
                    const escapedText = escapeHTML(match.text);
                    const highlightedText = escapedText.replace(regex, '<mark class="match-highlight">$1</mark>');
                    
                    const item = document.createElement('div');
                    item.className = 'search-result-item';
                    item.innerHTML = highlightedText;
                    
                    item.addEventListener('click', () => {
                        const headerHeight = document.querySelector('header').offsetHeight;
                        const rect = match.element.getBoundingClientRect();
                        const absoluteTop = window.pageYOffset + rect.top;
                        const targetScroll = absoluteTop - headerHeight - 60;
                        
                        window.scrollTo({
                            top: targetScroll,
                            behavior: 'smooth'
                        });
                        
                        match.element.classList.remove('flash-highlight');
                        void match.element.offsetWidth; // trigger reflow
                        match.element.classList.add('flash-highlight');
                        setTimeout(() => {
                            match.element.classList.remove('flash-highlight');
                        }, 1500);
                    });
                    
                    resultsList.appendChild(item);
                });
                
                if (isPaginationMode) {
                    updatePaginationHighlights();
                }
            }
        }

        // Setup Event Listeners for Search Panel & Theme Toggle
        function setupEventListeners() {
            const toggleBtn = document.getElementById('floating-search-toggle');
            const searchInput = document.getElementById('search-input');
            const clearBtn = document.getElementById('search-clear-btn');
            const closeBtn = document.getElementById('search-close-btn');
            const listBtn = document.getElementById('search-list-btn');
            const prevBtn = document.getElementById('search-prev-btn');
            const nextBtn = document.getElementById('search-next-btn');
            const themeToggleBtn = document.getElementById('theme-toggle-btn');
            
            if (toggleBtn) toggleBtn.addEventListener('click', toggleSearch);
            if (closeBtn) closeBtn.addEventListener('click', closeSearch);
            if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);
            
            if (searchInput) searchInput.addEventListener('input', performSearch);
            
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    searchInput.value = '';
                    performSearch();
                    searchInput.focus();
                });
            }
            
            if (listBtn) listBtn.addEventListener('click', exitPaginationMode);
            
            if (prevBtn) {
                prevBtn.addEventListener('click', () => {
                    if (!isPaginationMode) {
                        enterPaginationMode();
                        currentMatchIndex = -1;
                        navigateMatch(-1);
                    } else {
                        navigateMatch(-1);
                    }
                });
            }
            
            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    if (!isPaginationMode) {
                        enterPaginationMode();
                        currentMatchIndex = -1;
                        navigateMatch(1);
                    } else {
                        navigateMatch(1);
                    }
                });
            }
            
            document.addEventListener('keydown', (e) => {
                if (!isSearchOpen) return;
                
                if (e.key === 'Escape') {
                    closeSearch();
                    return;
                }
                
                if (isPaginationMode) {
                    if (e.key === 'ArrowDown' || e.key === 'Enter') {
                        e.preventDefault();
                        navigateMatch(1);
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        navigateMatch(-1);
                    }
                } else {
                    if (e.key === 'Enter' && searchQuery) {
                        e.preventDefault();
                        enterPaginationMode();
                    }
                }
            });
        }

        // Theme Helper Functions
        function setTheme(theme) {
            localStorage.setItem('theme', theme);
            updateThemeUI(theme);
        }

        function updateThemeUI(theme) {
            const themeToggleIcon = document.getElementById('theme-toggle-icon');
            if (theme === 'light') {
                document.body.classList.add('light-theme');
                document.body.classList.remove('dark-theme');
                if (themeToggleIcon) {
                    themeToggleIcon.className = 'fa-solid fa-moon';
                }
            } else {
                document.body.classList.add('dark-theme');
                document.body.classList.remove('light-theme');
                if (themeToggleIcon) {
                    themeToggleIcon.className = 'fa-solid fa-sun';
                }
            }
        }

        // Toggle theme between light and dark
        function toggleTheme() {
            let currentTheme = localStorage.getItem('theme');
            if (!currentTheme) {
                const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                currentTheme = systemPrefersDark ? 'dark' : 'light';
            }
            const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
            setTheme(nextTheme);
        }

        // Theme Sync on Initial Load
        function syncTheme() {
            let storedTheme = localStorage.getItem('theme');
            if (!storedTheme) {
                const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                storedTheme = systemPrefersDark ? 'dark' : 'light';
            }
            updateThemeUI(storedTheme);
        }

        // Initial Load
        syncTheme();
        setupEventListeners();

        window.addEventListener('popstate', () => {
            const urlParams = new URLSearchParams(window.location.search);
            loadMarkdown(urlParams.get('file'));
        });

        const urlParams = new URLSearchParams(window.location.search);
        loadMarkdown(urlParams.get('file'));
