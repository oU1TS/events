/**
 * UITS Event Raiders - SPA Client Application Controller
 * Author: Antigravity AI & oU1TS Community
 * Language: ES6+ (Vanilla JS)
 */

document.addEventListener('DOMContentLoaded', () => {
    // Cache UI Selectors
    const appThemeToggle = document.getElementById('theme-toggle');
    const sections = document.querySelectorAll('.section');
    const navLinks = document.querySelectorAll('#main-nav .nav-link');
    const mobileToggle = document.getElementById('mobile-toggle');
    const mainNav = document.getElementById('main-nav');
    const raidsContainer = document.getElementById('raids-container');

    // Available SPA Routes
    const validRoutes = ['#home', '#past-raids', '#join', '#learn-more'];

    // State Variables
    let pastRaidsData = null;
    let isDataLoading = false;

    /* ==========================================================================
       1. Theme Management (Light / Dark Mode)
       ========================================================================== */
    function initializeTheme() {
        const storedTheme = localStorage.getItem('theme');
        
        // System preference default check
        const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;

        if (storedTheme === 'light' || (!storedTheme && prefersLight)) {
            document.body.classList.add('light-theme');
            updateThemeToggleAccessibility(true);
        } else {
            document.body.classList.remove('light-theme');
            updateThemeToggleAccessibility(false);
        }
    }

    function toggleTheme() {
        const isLightThemeActive = document.body.classList.toggle('light-theme');
        localStorage.setItem('theme', isLightThemeActive ? 'light' : 'dark');
        updateThemeToggleAccessibility(isLightThemeActive);
    }

    function updateThemeToggleAccessibility(isLight) {
        appThemeToggle.setAttribute('aria-label', isLight ? 'Switch to Dark Theme' : 'Switch to Light Theme');
    }

    appThemeToggle.addEventListener('click', toggleTheme);

    /* ==========================================================================
       2. SPA Hash Routing
       ========================================================================== */
    function routePage() {
        let currentHash = window.location.hash;

        // Default route fallback if hash is empty or invalid
        if (!currentHash || !validRoutes.includes(currentHash)) {
            currentHash = '#home';
            // Silently update hash without triggering another route run
            history.replaceState(null, null, currentHash);
        }

        // 1. Update Active Navigation Links
        navLinks.forEach(link => {
            if (link.getAttribute('href') === currentHash) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // 2. Switch Section Visibility
        sections.forEach(section => {
            const sectionId = section.getAttribute('id');
            if (`#${sectionId}` === currentHash) {
                section.classList.add('active');
            } else {
                section.classList.remove('active');
            }
        });

        // 3. Trigger Data Fetching when entering Past Raids
        if (currentHash === '#past-raids') {
            loadPastRaids();
        }

        // 4. Scroll to top on navigation change
        window.scrollTo({ top: 0, behavior: 'instant' });

        // 5. Close mobile navigation menu if open
        closeMobileMenu();
    }

    // Hash change event listener
    window.addEventListener('hashchange', routePage);

    /* ==========================================================================
       3. Mobile Navigation Menu Toggle
       ========================================================================== */
    function toggleMobileMenu() {
        const isOpened = mainNav.classList.toggle('open');
        mobileToggle.classList.toggle('open');
        mobileToggle.setAttribute('aria-expanded', isOpened);
    }

    function closeMobileMenu() {
        mainNav.classList.remove('open');
        mobileToggle.classList.remove('open');
        mobileToggle.setAttribute('aria-expanded', false);
    }

    mobileToggle.addEventListener('click', toggleMobileMenu);

    // Close menu when clicking outside of the navbar
    document.addEventListener('click', (event) => {
        if (!mainNav.contains(event.target) && !mobileToggle.contains(event.target)) {
            closeMobileMenu();
        }
    });

    /* ==========================================================================
       4. Asynchronous Data Load & Card Render
       ========================================================================== */
    async function loadPastRaids() {
        // Prevent double loading or redundant fetches
        if (pastRaidsData || isDataLoading) return;

        isDataLoading = true;
        
        try {
            // Asynchronously fetch from separate JSON file
            const response = await fetch('raids.json');
            
            if (!response.ok) {
                throw new Error(`Failed to load data (HTTP ${response.status})`);
            }
            
            pastRaidsData = await response.json();
            renderRaids(pastRaidsData);
            
        } catch (error) {
            console.error('Error fetching past raids:', error);
            renderErrorBanner(error.message);
        } finally {
            isDataLoading = false;
        }
    }

    function renderRaids(raids) {
        // Clear skeleton loader elements
        raidsContainer.innerHTML = '';

        if (!raids || raids.length === 0) {
            raidsContainer.innerHTML = `
                <div class="error-banner">
                    <p>No past raids recorded yet. Assemble your team and map out the first raid!</p>
                </div>`;
            return;
        }

        raids.forEach(raid => {
            // Create Card Element
            const card = document.createElement('div');
            card.className = 'raid-card';

            // Meta Section
            const metaDiv = document.createElement('div');
            metaDiv.className = 'raid-meta';
            metaDiv.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <span>${escapeHTML(raid.dateRange)}</span>
            `;
            card.appendChild(metaDiv);

            // Title
            const titleEl = document.createElement('h3');
            titleEl.className = 'raid-title';
            titleEl.textContent = raid.title;
            card.appendChild(titleEl);

            // Details Dropdown (Venue, Fees, Sub Events)
            const detailsDropdown = document.createElement('details');
            detailsDropdown.className = 'details-dropdown';

            const detailsSummary = document.createElement('summary');
            detailsSummary.className = 'details-summary';
            detailsSummary.textContent = 'Details';
            detailsDropdown.appendChild(detailsSummary);

            // Information Group
            const infoGroup = document.createElement('div');
            infoGroup.className = 'details-content raid-info-group';

            // Venue Info
            const venueItem = createInfoItem('Venue', raid.venue);
            infoGroup.appendChild(venueItem);

            // Fee Info
            const feeItem = createInfoItem('Fees', raid.fee);
            infoGroup.appendChild(feeItem);

            // Sub Events Info (Supports string or array of collapsible schedule items)
            if (raid.subEvents) {
                const subEventsItem = document.createElement('div');
                subEventsItem.className = 'raid-info-item raid-schedule-group';

                const labelSpan = document.createElement('span');
                labelSpan.className = 'raid-info-label';
                labelSpan.textContent = 'Schedule';
                subEventsItem.appendChild(labelSpan);

                const valueSpan = document.createElement('div');
                valueSpan.className = 'raid-info-value';

                if (Array.isArray(raid.subEvents)) {
                    raid.subEvents.forEach(sub => {
                        const detailsEl = document.createElement('details');
                        detailsEl.className = 'schedule-dropdown';

                        const summaryEl = document.createElement('summary');
                        summaryEl.className = 'schedule-summary';
                        summaryEl.textContent = sub.title;

                        const contentDiv = document.createElement('div');
                        contentDiv.className = 'schedule-dropdown-content raid-sub-events';
                        contentDiv.textContent = sub.details;

                        detailsEl.appendChild(summaryEl);
                        detailsEl.appendChild(contentDiv);
                        valueSpan.appendChild(detailsEl);
                    });
                } else {
                    const textSpan = document.createElement('span');
                    textSpan.className = 'raid-sub-events';
                    textSpan.textContent = raid.subEvents;
                    valueSpan.appendChild(textSpan);
                }

                subEventsItem.appendChild(valueSpan);
                infoGroup.appendChild(subEventsItem);
            }

            detailsDropdown.appendChild(infoGroup);
            card.appendChild(detailsDropdown);

            // Detailed Description (Supports multi-line display via pre-line)
            const detailsEl = document.createElement('p');
            detailsEl.className = 'raid-details';
            detailsEl.textContent = raid.details;
            card.appendChild(detailsEl);

            // Important Links Section
            if (raid.links && Object.keys(raid.links).length > 0) {
                const linksWrapper = document.createElement('div');
                linksWrapper.className = 'raid-links-wrapper';

                Object.entries(raid.links).forEach(([linkName, url]) => {
                    const anchor = document.createElement('a');
                    anchor.className = 'raid-link';
                    
                    if (linkName.toLowerCase() === 'notes') {
                        anchor.href = `render.html?file=${encodeURIComponent(url)}`;
                        anchor.target = '_blank';
                        anchor.rel = 'noopener noreferrer';
                        anchor.innerHTML = `
                            <span>View Notes</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                <polyline points="10 9 9 9 8 9"></polyline>
                            </svg>
                        `;
                    } else {
                        anchor.href = url;
                        anchor.target = '_blank';
                        anchor.rel = 'noopener noreferrer';
                        anchor.innerHTML = `
                            <span>${escapeHTML(linkName)}</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="7" y1="17" x2="17" y2="7"></line>
                                <polyline points="7 7 17 7 17 17"></polyline>
                            </svg>
                        `;
                    }
                    linksWrapper.appendChild(anchor);
                });

                card.appendChild(linksWrapper);
            }

            // Append Card to container
            raidsContainer.appendChild(card);
        });
    }

    function createInfoItem(label, value) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'raid-info-item';

        const labelSpan = document.createElement('span');
        labelSpan.className = 'raid-info-label';
        labelSpan.textContent = label;

        const valueSpan = document.createElement('span');
        valueSpan.className = 'raid-info-value';
        valueSpan.textContent = value;

        itemDiv.appendChild(labelSpan);
        itemDiv.appendChild(valueSpan);
        return itemDiv;
    }

    function renderErrorBanner(errorMessage) {
        raidsContainer.innerHTML = `
            <div class="error-banner">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 1rem;">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <h3>Failed to Load Raids</h3>
                <p>We encountered an issue while loading the past campaigns: "${escapeHTML(errorMessage)}".</p>
                <button onclick="window.location.reload()" style="margin-top: 1rem; padding: 0.5rem 1.25rem; background-color: #ef4444; color: white; border-radius: 8px; font-weight: 600;">Retry</button>
            </div>
        `;
    }

    // Helper: Basic HTML escaping to prevent XSS injection
    function escapeHTML(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /* ==========================================================================
       5. Initialize Application
       ========================================================================== */
    initializeTheme();
    routePage();
});
