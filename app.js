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
    const validRoutes = ['#home', '#raids', '#notes', '#join', '#learn-more'];

    // State Variables
    let pastRaidsData = null;
    let isDataLoading = false;
    let pendingRaidScroll = null;
    let currentFilterType = 'all';

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
        if (window.closeCalendarModal) {
            window.closeCalendarModal();
        }
        let currentHash = window.location.hash;
        let targetRaidNum = null;

        // Parse hash to see if it's a raid link, e.g., #raid-1
        if (currentHash.startsWith('#raid-')) {
            targetRaidNum = parseInt(currentHash.replace('#raid-', ''), 10);
            currentHash = '#raids';
            resetTypeFilter();
        }

        // Support backward compatibility for legacy hash
        if (currentHash === '#past-raids') {
            currentHash = '#raids';
            history.replaceState(null, null, currentHash);
        }

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

        // 3. Trigger Data Fetching when entering Past Raids & Event Notes
        if (currentHash === '#raids' || currentHash === '#notes') {
            if (targetRaidNum) {
                if (pastRaidsData) {
                    scrollToRaid(targetRaidNum);
                } else {
                    pendingRaidScroll = targetRaidNum;
                    loadPastRaids();
                }
            } else {
                if (pastRaidsData) {
                    if (currentHash === '#notes') {
                        renderEventNotes(pastRaidsData);
                    } else {
                        filterAndRenderRaids();
                    }
                } else {
                    loadPastRaids();
                }
            }
            if (window.enableFloatingCalendarBtn) {
                window.enableFloatingCalendarBtn(true);
            }
        } else {
            if (window.enableFloatingCalendarBtn) {
                window.enableFloatingCalendarBtn(false);
            }
        }

        // 4. Scroll to top on navigation change (only if not scrolling to a specific raid card)
        if (!targetRaidNum) {
            window.scrollTo({ top: 0, behavior: 'instant' });
        }

        // 5. Close mobile navigation menu if open
        closeMobileMenu();
    }

    function scrollToRaid(raidNum) {
        // Wait slightly to ensure elements are rendered and transition finished
        setTimeout(() => {
            const card = document.getElementById(`raid-card-${raidNum}`);
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.classList.add('highlighted');
                card.addEventListener('animationend', () => {
                    card.classList.remove('highlighted');
                }, { once: true });
            }
        }, 200);
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
            filterAndRenderRaids();
            renderEventNotes(pastRaidsData);
            
        } catch (error) {
            console.error('Error fetching past raids:', error);
            renderErrorBanner(error.message);
        } finally {
            isDataLoading = false;
        }
    }

    function filterAndRenderRaids() {
        if (!pastRaidsData) return;
        
        let filtered = pastRaidsData;
        if (currentFilterType !== 'all') {
            filtered = pastRaidsData.filter(raid => raid.Type === currentFilterType);
        }
        
        renderRaids(filtered);
    }

    function getShortTitle(title) {
        if (!title) return '';
        let short = title;
        if (short.includes('(')) {
            short = short.split('(')[0];
        }
        if (short.includes(':')) {
            short = short.split(':')[0];
        }
        return short.trim();
    }

    function renderEventNotes(raids) {
        const notesContainer = document.getElementById('notes-container');
        if (!notesContainer) return;
        
        notesContainer.innerHTML = '';
        
        // Filter raids that have a "notes" link
        const notesRaids = raids.filter(raid => raid.links && raid.links.notes);
        
        if (notesRaids.length === 0) {
            notesContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">No notes available at the moment.</p>';
            return;
        }
        
        notesRaids.forEach(raid => {
            const card = document.createElement('div');
            card.className = 'resource-card';
            
            // Build card content
            const titleEl = document.createElement('h3');
            titleEl.className = 'resource-title';
            titleEl.textContent = getShortTitle(raid.title);
            card.appendChild(titleEl);
            
            const actionContainer = document.createElement('div');
            actionContainer.style.display = 'flex';
            actionContainer.style.gap = '1rem';
            actionContainer.style.marginTop = 'auto';
            actionContainer.style.flexWrap = 'wrap';
            
            // Link to the rendered markdown notes
            const notesUrl = raid.links.notes;
            const notesLink = document.createElement('a');
            notesLink.className = 'raid-link';
            notesLink.href = `render.html?file=${encodeURIComponent(notesUrl)}`;
            notesLink.innerHTML = `
                <span>View Notes</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
            `;
            actionContainer.appendChild(notesLink);
            
            // Link to the corresponding raid card in the #raids section
            const cardLink = document.createElement('a');
            cardLink.className = 'raid-link';
            cardLink.href = `#raid-${raid.Raid_Num}`;
            cardLink.innerHTML = `
                <span>View Campaign</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="7" y1="17" x2="17" y2="7"></line>
                    <polyline points="7 7 17 7 17 17"></polyline>
                </svg>
            `;
            actionContainer.appendChild(cardLink);
            
            card.appendChild(actionContainer);
            notesContainer.appendChild(card);
        });
    }

    function formatLocalDate(dateStr) {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        const year = parts[0];
        const monthIndex = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        
        if (monthIndex >= 0 && monthIndex < 12) {
            return `${day} ${monthNames[monthIndex]} ${year}`;
        }
        return dateStr;
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
            card.id = `raid-card-${raid.Raid_Num}`;

            // Meta Section
            const metaDiv = document.createElement('div');
            metaDiv.className = 'raid-meta';

            // Dynamically check and update Status from Future to Past if the date has passed
            if (raid.endDate) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const checkDate = new Date(raid.endDate);
                checkDate.setHours(0, 0, 0, 0);
                if (today > checkDate) {
                    raid.Status = "Past";
                }
            }

            const statusText = raid.Status || "Future";
            const statusClass = statusText.toLowerCase() === 'future' ? 'status-future' : 'status-past';

            metaDiv.innerHTML = `
                <div class="raid-date-wrapper">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    <span>${escapeHTML(raid.dateRange)}</span>
                </div>
                <div class="raid-meta-right">
                    <button class="copy-raid-link-btn" title="Copy link to this raid" aria-label="Copy link to this raid">
                        <svg class="copy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                    <span class="status-badge ${statusClass}">${escapeHTML(statusText)}</span>
                </div>
            `;

            const copyBtn = metaDiv.querySelector('.copy-raid-link-btn');
            if (copyBtn) {
                copyBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const raidUrl = window.location.href.split('#')[0] + '#raid-' + raid.Raid_Num;
                    navigator.clipboard.writeText(raidUrl).then(() => {
                        copyBtn.classList.add('copied');
                        copyBtn.innerHTML = `
                            <svg class="check-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        `;
                        setTimeout(() => {
                            copyBtn.classList.remove('copied');
                            copyBtn.innerHTML = `
                                <svg class="copy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                            `;
                        }, 2000);
                    }).catch(err => {
                        console.error('Failed to copy link: ', err);
                    });
                });
            }

            card.appendChild(metaDiv);

            // Event Type Tag
            if (raid.Type) {
                const typeTag = document.createElement('span');
                typeTag.className = 'raid-type-tag';
                typeTag.textContent = raid.Type;
                card.appendChild(typeTag);
            }

            // Title
            const titleEl = document.createElement('h3');
            titleEl.className = 'raid-title';
            titleEl.textContent = raid.title;
            card.appendChild(titleEl);

            // Detailed Description (Supports multi-line display via pre-line)
            const detailsEl = document.createElement('p');
            detailsEl.className = 'raid-details';
            detailsEl.textContent = raid.details;
            card.appendChild(detailsEl);

            // Highlighted "See More" / "See Less" Button for Mobile
            const seeMoreBtn = document.createElement('button');
            seeMoreBtn.className = 'see-more-btn';
            seeMoreBtn.textContent = 'See More';
            seeMoreBtn.addEventListener('click', () => {
                const isExpanded = detailsEl.classList.toggle('expanded');
                seeMoreBtn.textContent = isExpanded ? 'See Less' : 'See More';
            });
            card.appendChild(seeMoreBtn);

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

            // Registration Deadline Info
            if (raid.RegEndDate) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const regDate = new Date(raid.RegEndDate);
                regDate.setHours(0, 0, 0, 0);
                
                const isClosed = today > regDate;
                const formattedRegDate = formatLocalDate(raid.RegEndDate);
                const regText = isClosed ? `${formattedRegDate} (Closed)` : formattedRegDate;
                
                const regEndItem = createInfoItem('Reg Deadline', regText);
                const valSpan = regEndItem.querySelector('.raid-info-value');
                if (isClosed) {
                    valSpan.style.color = 'var(--text-muted)';
                } else {
                    valSpan.style.color = 'var(--success-color)';
                    valSpan.style.fontWeight = '600';
                }
                infoGroup.appendChild(regEndItem);
            }

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



            // Important Links Section
            if (raid.links && Object.keys(raid.links).length > 0) {
                const linksWrapper = document.createElement('div');
                linksWrapper.className = 'raid-links-wrapper';

                Object.entries(raid.links).forEach(([linkName, url]) => {
                    const anchor = document.createElement('a');
                    anchor.className = 'raid-link';
                    
                    if (linkName.toLowerCase() === 'notes') {
                        anchor.href = `render.html?file=${encodeURIComponent(url)}`;
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

        // Check for pending raid scroll
        if (pendingRaidScroll) {
            scrollToRaid(pendingRaidScroll);
            pendingRaidScroll = null;
        }
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
       5. Campaign Calendar Controller
       ========================================================================== */
    function initCalendar() {
        const openCalendarBtn = document.getElementById('open-calendar-btn');
        const floatingCalendarBtn = document.getElementById('floating-calendar-btn');
        const closeCalendarBtn = document.getElementById('close-calendar-btn');
        const calendarModal = document.getElementById('calendar-modal');
        const calendarBackdrop = document.getElementById('calendar-modal-backdrop');
        const calendarMonthYear = document.getElementById('calendar-month-year');
        const calendarDays = document.getElementById('calendar-days');
        const prevMonthBtn = document.getElementById('prev-month-btn');
        const nextMonthBtn = document.getElementById('next-month-btn');
        
        const dayEventsOverlay = document.getElementById('day-events-overlay');
        const overlayDateLabel = document.getElementById('overlay-date-label');
        const overlayEventsList = document.getElementById('overlay-events-list');
        const closeOverlayBtn = document.getElementById('close-overlay-btn');

        // State for currently displayed calendar month (Default: July 2026)
        let calendarYear = 2026;
        let calendarMonth = 6; // July (0-indexed)

        if (!openCalendarBtn || !calendarModal) return;

        // State variables for routing page & scroll states
        let isRaidsActive = false;
        let isStaticBtnScrolledAway = false;

        const updateFloatingBtnVisibility = () => {
            if (floatingCalendarBtn) {
                if (isRaidsActive && isStaticBtnScrolledAway) {
                    floatingCalendarBtn.classList.add('show');
                } else {
                    floatingCalendarBtn.classList.remove('show');
                }
            }
        };

        // Window hook to enable/disable floating button from the router
        window.enableFloatingCalendarBtn = (active) => {
            isRaidsActive = active;
            updateFloatingBtnVisibility();
        };

        // Floating button observer: trigger floating style when static container scrolls out of view
        const calendarBtnContainer = document.querySelector('.calendar-btn-container');
        if (calendarBtnContainer) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    isStaticBtnScrolledAway = !entry.isIntersecting && entry.boundingClientRect.top < 0;
                    updateFloatingBtnVisibility();
                });
            }, { threshold: 0 });
            observer.observe(calendarBtnContainer);
        }

        const openModalWithData = () => {
            if (!pastRaidsData) {
                loadPastRaids().then(() => {
                    renderCalendarGrid();
                    openModal();
                });
            } else {
                renderCalendarGrid();
                openModal();
            }
        };

        // Open modal
        openCalendarBtn.addEventListener('click', openModalWithData);
        if (floatingCalendarBtn) {
            floatingCalendarBtn.addEventListener('click', openModalWithData);
        }

        // Close modal
        closeCalendarBtn.addEventListener('click', closeModal);
        if (calendarBackdrop) {
            calendarBackdrop.addEventListener('click', closeModal);
        }

        // Prev/Next month navigation
        prevMonthBtn.addEventListener('click', () => {
            calendarMonth--;
            if (calendarMonth < 0) {
                calendarMonth = 11;
                calendarYear--;
            }
            renderCalendarGrid();
        });

        nextMonthBtn.addEventListener('click', () => {
            calendarMonth++;
            if (calendarMonth > 11) {
                calendarMonth = 0;
                calendarYear++;
            }
            renderCalendarGrid();
        });

        // Close events overlay
        closeOverlayBtn.addEventListener('click', closeOverlay);

        function openModal() {
            calendarModal.classList.add('open');
            calendarModal.setAttribute('aria-hidden', 'false');
        }

        function closeModal() {
            calendarModal.classList.remove('open');
            calendarModal.setAttribute('aria-hidden', 'true');
            closeOverlay();
        }

        // Export closeModal to window scope so routing can trigger it
        window.closeCalendarModal = closeModal;

        function closeOverlay() {
            dayEventsOverlay.classList.remove('open');
        }

        // Helper: timezone-safe local date parser
        function parseLocalDate(dateStr) {
            if (!dateStr) return null;
            const parts = dateStr.split('-');
            if (parts.length !== 3) return null;
            return {
                year: parseInt(parts[0], 10),
                month: parseInt(parts[1], 10) - 1, // 0-indexed
                day: parseInt(parts[2], 10)
            };
        }

        function renderCalendarGrid() {
            calendarDays.innerHTML = '';
            closeOverlay();

            // Month names
            const monthNames = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];
            calendarMonthYear.textContent = `${monthNames[calendarMonth]} ${calendarYear}`;

            // First day of the month (0 = Sun, 1 = Mon, ..., 6 = Sat)
            const firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay();

            // Last day of the month
            const lastDay = new Date(calendarYear, calendarMonth + 1, 0).getDate();

            // Today's date info for today highlighting
            const today = new Date();
            const isCurrentMonthYear = today.getFullYear() === calendarYear && today.getMonth() === calendarMonth;

            // Render empty cells for padding before the 1st of the month
            for (let i = 0; i < firstDayIndex; i++) {
                const emptyCell = document.createElement('div');
                emptyCell.className = 'calendar-day empty';
                calendarDays.appendChild(emptyCell);
            }

            // Group raids by day for this month and year
            const eventsByDay = {};
            if (pastRaidsData) {
                pastRaidsData.forEach(raid => {
                    const parsed = parseLocalDate(raid.startDate);
                    if (parsed && parsed.year === calendarYear && parsed.month === calendarMonth) {
                        if (!eventsByDay[parsed.day]) {
                            eventsByDay[parsed.day] = [];
                        }
                        eventsByDay[parsed.day].push(raid);
                    }
                });
            }

            // Render day cells
            for (let day = 1; day <= lastDay; day++) {
                const dayCell = document.createElement('div');
                dayCell.className = 'calendar-day';
                dayCell.textContent = day;

                // Today highlighting
                if (isCurrentMonthYear && today.getDate() === day) {
                    dayCell.classList.add('today');
                }

                // Check if any events fall on this day
                const dayEvents = eventsByDay[day];
                if (dayEvents && dayEvents.length > 0) {
                    dayCell.classList.add('highlighted');
                    dayCell.setAttribute('role', 'button');
                    dayCell.setAttribute('tabindex', '0');

                    // If 2 or more events overlap, render badge count
                    if (dayEvents.length >= 2) {
                        const badge = document.createElement('span');
                        badge.className = 'event-count-badge';
                        badge.textContent = dayEvents.length;
                        dayCell.appendChild(badge);
                    }

                    // Click handler
                    dayCell.addEventListener('click', (e) => {
                        e.stopPropagation();
                        showDayEvents(day, monthNames[calendarMonth], dayEvents);
                    });

                    // Keyboard access
                    dayCell.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            showDayEvents(day, monthNames[calendarMonth], dayEvents);
                        }
                    });
                }

                calendarDays.appendChild(dayCell);
            }

            // Pad the rest of the grid if necessary to maintain exact row heights/alignment
            const totalCells = firstDayIndex + lastDay;
            const remaining = 42 - totalCells; // 6 rows * 7 columns = 42 cells total
            for (let i = 0; i < remaining; i++) {
                const emptyCell = document.createElement('div');
                emptyCell.className = 'calendar-day empty';
                calendarDays.appendChild(emptyCell);
            }
        }

        function showDayEvents(day, monthName, events) {
            overlayDateLabel.textContent = `Events on ${day} ${monthName} ${calendarYear}`;
            overlayEventsList.innerHTML = '';

            events.forEach(raid => {
                const eventItem = document.createElement('button');
                eventItem.className = 'overlay-event-item';
                eventItem.setAttribute('aria-label', `Navigate to ${raid.title}`);
                
                eventItem.innerHTML = `
                    <span class="overlay-event-title">${escapeHTML(raid.title)}</span>
                    <span class="overlay-event-link-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="7" y1="17" x2="17" y2="7"></line>
                            <polyline points="7 7 17 7 17 17"></polyline>
                        </svg>
                    </span>
                `;

                eventItem.addEventListener('click', () => {
                    closeModal();
                    window.location.hash = `#raid-${raid.Raid_Num}`;
                });

                overlayEventsList.appendChild(eventItem);
            });

            dayEventsOverlay.classList.add('open');
        }
    }


    /* ==========================================================================
       6a. Event Type Dropdown Filter Controls
       ========================================================================== */
    function initDropdownFilter() {
        const filterContainer = document.getElementById('event-type-filter-container');
        const filterBtn = document.getElementById('filter-type-btn');
        const filterBtnText = document.getElementById('filter-btn-text');
        const dropdownMenu = filterContainer.querySelector('.dropdown-menu');
        const dropdownItems = filterContainer.querySelectorAll('.dropdown-item');

        if (!filterBtn || !dropdownMenu) return;

        // Toggle dropdown open/close
        filterBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = filterContainer.classList.toggle('open');
            dropdownMenu.classList.toggle('show');
            filterBtn.setAttribute('aria-expanded', isOpen);
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!filterContainer.contains(e.target)) {
                filterContainer.classList.remove('open');
                dropdownMenu.classList.remove('show');
                filterBtn.setAttribute('aria-expanded', 'false');
            }
        });

        // Dropdown options selection
        dropdownItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Update active state in UI
                dropdownItems.forEach(i => {
                    i.classList.remove('active');
                    i.setAttribute('aria-selected', 'false');
                });
                item.classList.add('active');
                item.setAttribute('aria-selected', 'true');

                // Update trigger button label
                const selectedVal = item.getAttribute('data-value');
                const selectedText = item.textContent;
                
                if (selectedVal === 'all') {
                    filterBtnText.textContent = 'All Types';
                } else {
                    filterBtnText.textContent = selectedText;
                }

                // Close dropdown
                filterContainer.classList.remove('open');
                dropdownMenu.classList.remove('show');
                filterBtn.setAttribute('aria-expanded', 'false');

                // Trigger filter and render
                currentFilterType = selectedVal;
                filterAndRenderRaids();
            });
        });
    }

    function resetTypeFilter() {
        currentFilterType = 'all';
        const filterContainer = document.getElementById('event-type-filter-container');
        if (!filterContainer) return;
        
        const filterBtnText = document.getElementById('filter-btn-text');
        if (filterBtnText) {
            filterBtnText.textContent = 'All Types';
        }
        
        const filterBtn = document.getElementById('filter-type-btn');
        if (filterBtn) {
            filterBtn.setAttribute('aria-expanded', 'false');
        }
        
        const dropdownMenu = filterContainer.querySelector('.dropdown-menu');
        if (dropdownMenu) {
            dropdownMenu.classList.remove('show');
        }
        filterContainer.classList.remove('open');

        const dropdownItems = filterContainer.querySelectorAll('.dropdown-item');
        dropdownItems.forEach(item => {
            if (item.getAttribute('data-value') === 'all') {
                item.classList.add('active');
                item.setAttribute('aria-selected', 'true');
            } else {
                item.classList.remove('active');
                item.setAttribute('aria-selected', 'false');
            }
        });
        
        filterAndRenderRaids();
    }

    /* ==========================================================================
       7. Initialize Application
       ========================================================================== */
    initializeTheme();
    initCalendar();
    initDropdownFilter();
    routePage();
});
