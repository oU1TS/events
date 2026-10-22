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
    let showPastRaids = false;

    function isPastRaid(raid) {
        if (!raid) return false;
        if (raid.Status === 'Past') return true;
        if (raid.endDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const checkDate = new Date(raid.endDate);
            checkDate.setHours(0, 0, 0, 0);
            if (today > checkDate) {
                raid.Status = 'Past';
                return true;
            }
        }
        return false;
    }

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
                    const targetRaid = pastRaidsData.find(r => r.Raid_Num === targetRaidNum);
                    if (targetRaid && isPastRaid(targetRaid)) {
                        showPastRaids = true;
                        updatePastRaidsToggleUI();
                    }
                    filterAndRenderRaids();
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
                if (card.tagName.toLowerCase() === 'details') {
                    card.open = true;
                }
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
    async function loadPastRaids(options = {}) {
        // Prevent double loading or redundant fetches unless forced
        if (pastRaidsData && !options.forceFresh) return;
        if (isDataLoading) return;

        isDataLoading = true;

        try {
            // Fetch from separate JSON file, force bypass browser cache if requested
            const fetchOptions = options.forceFresh ? { cache: 'no-cache' } : {};
            const response = await fetch('raids.json', fetchOptions);

            if (!response.ok) {
                throw new Error(`Failed to load data (HTTP ${response.status})`);
            }

            pastRaidsData = await response.json();
            if (pendingRaidScroll) {
                const targetRaid = pastRaidsData.find(r => r.Raid_Num === pendingRaidScroll);
                if (targetRaid && isPastRaid(targetRaid)) {
                    showPastRaids = true;
                    updatePastRaidsToggleUI();
                }
            }
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

        // Filter out past raids if showPastRaids is false
        if (!showPastRaids) {
            filtered = filtered.filter(raid => !isPastRaid(raid));
        }

        if (currentFilterType !== 'all') {
            filtered = filtered.filter(raid => raid.Type === currentFilterType);
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
            // Create Parent Collapsible Card Element (<details>)
            const card = document.createElement('details');
            card.className = 'raid-card parent-raid-card';
            card.id = `raid-card-${raid.Raid_Num}`;

            // Create Summary Header Element (<summary>)
            const summaryEl = document.createElement('summary');
            summaryEl.className = 'parent-raid-summary';

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
                    <span class="status-badge ${statusClass}">${escapeHTML(statusText)}</span>
                </div>
            `;

            // If user is logged in, append Suggest Edit button next to status badge
            if (currentSessionUser) {
                const metaRight = metaDiv.querySelector('.raid-meta-right');
                if (metaRight) {
                    const editBtn = document.createElement('button');
                    editBtn.type = 'button';
                    editBtn.className = 'raid-edit-suggest-btn';
                    editBtn.innerHTML = `
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        <span>Edit</span>
                    `;
                    editBtn.title = `Propose an update for Raid #${raid.Raid_Num}`;
                    editBtn.setAttribute('aria-label', `Propose update for Raid #${raid.Raid_Num}`);
                    editBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (window.openEventFormModal) {
                            window.openEventFormModal('update', raid);
                        }
                    });
                    metaRight.insertBefore(editBtn, metaRight.firstChild);
                }
            }

            // Protruding Copy Link Button at top-right corner of card
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-raid-link-btn';
            copyBtn.title = 'Copy link to this raid';
            copyBtn.setAttribute('aria-label', 'Copy link to this raid');
            copyBtn.innerHTML = `
                <svg class="copy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
            `;
            copyBtn.addEventListener('click', (e) => {
                e.preventDefault();
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
            summaryEl.appendChild(copyBtn);

            summaryEl.appendChild(metaDiv);

            // Title Row with Chevron Arrow
            const titleRow = document.createElement('div');
            titleRow.className = 'parent-raid-title-row';

            const titleEl = document.createElement('h3');
            titleEl.className = 'raid-title';
            titleEl.textContent = raid.title;
            titleRow.appendChild(titleEl);

            const arrowSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            arrowSvg.setAttribute('class', 'parent-raid-arrow');
            arrowSvg.setAttribute('width', '20');
            arrowSvg.setAttribute('height', '20');
            arrowSvg.setAttribute('viewBox', '0 0 24 24');
            arrowSvg.setAttribute('fill', 'none');
            arrowSvg.setAttribute('stroke', 'currentColor');
            arrowSvg.setAttribute('stroke-width', '2.5');
            arrowSvg.setAttribute('stroke-linecap', 'round');
            arrowSvg.setAttribute('stroke-linejoin', 'round');
            arrowSvg.innerHTML = '<polyline points="6 9 12 15 18 9"></polyline>';
            titleRow.appendChild(arrowSvg);

            summaryEl.appendChild(titleRow);

            // Event Type Tag (Displayed below title)
            if (raid.Type) {
                const typeTag = document.createElement('span');
                typeTag.className = 'raid-type-tag';
                typeTag.textContent = raid.Type;
                summaryEl.appendChild(typeTag);
            }

            // Venue Location Badge (Bottom-Right Corner of card summary)
            if (raid.OutsideDhaka) {
                // Outside Dhaka: Dynamic 2-second toggle between <s>Dhaka</s> and location icon only
                const cornerBadge = document.createElement('a');
                cornerBadge.className = 'raid-venue-corner-badge outside-dhaka-tag map-link';
                cornerBadge.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(raid.venue)}`;
                cornerBadge.target = '_blank';
                cornerBadge.rel = 'noopener noreferrer';
                cornerBadge.title = 'View venue location on Google Maps';
                cornerBadge.addEventListener('click', (e) => {
                    e.stopPropagation();
                });

                const pinSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;

                const htmlStateDhaka = `<s>Dhaka</s>`;
                const htmlStateIcon = pinSvg;

                cornerBadge.innerHTML = htmlStateDhaka;

                let showIconOnly = false;
                const cycleInterval = setInterval(() => {
                    if (!document.body.contains(cornerBadge)) {
                        clearInterval(cycleInterval);
                        return;
                    }
                    showIconOnly = !showIconOnly;
                    cornerBadge.classList.add('fade-transition');
                    setTimeout(() => {
                        cornerBadge.innerHTML = showIconOnly ? htmlStateIcon : htmlStateDhaka;
                        cornerBadge.classList.toggle('icon-only', showIconOnly);
                        cornerBadge.classList.remove('fade-transition');
                    }, 180);
                }, 2000);

                summaryEl.appendChild(cornerBadge);
            } else if (raid.IsOnline) {
                // Online Event: Online pill badge
                const cornerBadge = document.createElement('span');
                cornerBadge.className = 'raid-venue-corner-badge is-online-tag';
                cornerBadge.textContent = 'Online';
                summaryEl.appendChild(cornerBadge);
            } else {
                // OutsideDhaka = False & Physical Venue: Static borderless/backgroundless location icon linked to Google Maps
                const cornerBadge = document.createElement('a');
                cornerBadge.className = 'raid-venue-corner-badge static-location-tag map-link icon-only';
                cornerBadge.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(raid.venue)}`;
                cornerBadge.target = '_blank';
                cornerBadge.rel = 'noopener noreferrer';
                cornerBadge.title = `View venue location on Google Maps`;
                cornerBadge.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
                cornerBadge.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;
                summaryEl.appendChild(cornerBadge);
            }

            card.appendChild(summaryEl);

            // Parent Body Container (Revealed when expanded)
            const bodyDiv = document.createElement('div');
            bodyDiv.className = 'parent-raid-body';

            // Detailed Description (Supports multi-line display via pre-line)
            const detailsEl = document.createElement('p');
            detailsEl.className = 'raid-details';
            detailsEl.textContent = raid.details;
            bodyDiv.appendChild(detailsEl);

            // Highlighted "See More" / "See Less" Button for Mobile
            const seeMoreBtn = document.createElement('button');
            seeMoreBtn.className = 'see-more-btn';
            seeMoreBtn.textContent = 'See More';
            seeMoreBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isExpanded = detailsEl.classList.toggle('expanded');
                seeMoreBtn.textContent = isExpanded ? 'See Less' : 'See More';
            });
            bodyDiv.appendChild(seeMoreBtn);

            // Details Dropdown (Venue, Fees, Sub Events)
            const detailsDropdown = document.createElement('details');
            detailsDropdown.className = 'details-dropdown';
            detailsDropdown.addEventListener('click', (e) => {
                e.stopPropagation();
            });

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
                        const subDetailsEl = document.createElement('details');
                        subDetailsEl.className = 'schedule-dropdown';
                        subDetailsEl.addEventListener('click', (e) => {
                            e.stopPropagation();
                        });

                        const subSummaryEl = document.createElement('summary');
                        subSummaryEl.className = 'schedule-summary';
                        subSummaryEl.textContent = sub.title;

                        const contentDiv = document.createElement('div');
                        contentDiv.className = 'schedule-dropdown-content raid-sub-events';
                        contentDiv.textContent = sub.details;

                        subDetailsEl.appendChild(subSummaryEl);
                        subDetailsEl.appendChild(contentDiv);
                        valueSpan.appendChild(subDetailsEl);
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
            bodyDiv.appendChild(detailsDropdown);

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

                bodyDiv.appendChild(linksWrapper);
            }

            card.appendChild(bodyDiv);

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
        const floatingPastRaidsBtn = document.getElementById('floating-past-raids-btn');
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
            if (isRaidsActive && isStaticBtnScrolledAway) {
                if (floatingCalendarBtn) floatingCalendarBtn.classList.add('show');
                if (floatingPastRaidsBtn) floatingPastRaidsBtn.classList.add('show');
            } else {
                if (floatingCalendarBtn) floatingCalendarBtn.classList.remove('show');
                if (floatingPastRaidsBtn) floatingPastRaidsBtn.classList.remove('show');
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

                    // Gray out date cell if ALL events on this date are past raids
                    const allPastEvents = dayEvents.every(raid => isPastRaid(raid));
                    if (allPastEvents) {
                        dayCell.classList.add('past-only');
                    }

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
       6b. Past Raids Toggle Controls
       ========================================================================== */
    function updatePastRaidsToggleUI() {
        const toggleBtns = document.querySelectorAll('#toggle-past-raids-btn, #floating-past-raids-btn');
        const toggleText = document.getElementById('toggle-past-raids-text');

        toggleBtns.forEach(btn => {
            if (showPastRaids) {
                btn.classList.add('active');
                btn.setAttribute('aria-pressed', 'true');
                const svg = btn.querySelector('svg');
                if (svg) {
                    svg.innerHTML = `
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                    `;
                }
            } else {
                btn.classList.remove('active');
                btn.setAttribute('aria-pressed', 'false');
                const svg = btn.querySelector('svg');
                if (svg) {
                    svg.innerHTML = `
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    `;
                }
            }
        });

        if (toggleText) {
            toggleText.textContent = showPastRaids ? 'Hide Past Raids' : 'Unhide Past Raids';
        }
    }

    function initPastRaidsToggle() {
        const toggleBtns = document.querySelectorAll('#toggle-past-raids-btn, #floating-past-raids-btn');
        toggleBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                showPastRaids = !showPastRaids;
                updatePastRaidsToggleUI();
                filterAndRenderRaids();
            });
        });
    }

    /* ==========================================================================
       7. Caching Registry & Client-Side Notifications Engine
       ========================================================================== */
    async function initCacheAndNotifications() {
        try {
            // Aggressive cache fetch: bypass browser asset cache for tracker.json
            const trackerResponse = await fetch('tracker.json', { cache: 'no-cache' });
            if (!trackerResponse.ok) {
                throw new Error(`Failed to fetch tracker.json: ${trackerResponse.status}`);
            }
            const remoteTracker = await trackerResponse.json();

            // State validation in localStorage
            const localTrackerStr = localStorage.getItem('ev_tracker');
            let localTracker = { eventsCount: 0, lastUpdated: '' };
            if (localTrackerStr) {
                try {
                    localTracker = JSON.parse(localTrackerStr);
                } catch (e) {
                    console.error('Error parsing local tracker, resetting cache', e);
                }
            }

            const hasNewerCount = remoteTracker.eventsCount > localTracker.eventsCount;
            const hasNewerUpdate = remoteTracker.lastUpdated !== localTracker.lastUpdated;

            if (hasNewerCount || hasNewerUpdate) {
                console.log('Stale cache detected. Flushing local cache parameters and fetching new raids...');
                // Update local storage configuration parameters
                localStorage.setItem('ev_tracker', JSON.stringify({
                    eventsCount: remoteTracker.eventsCount,
                    lastUpdated: remoteTracker.lastUpdated
                }));
                // Force fresh load of raids.json
                await loadPastRaids({ forceFresh: true });
            } else {
                // Load using standard cache profile
                await loadPastRaids();
            }

            // Registration Deadline Evaluation
            if (remoteTracker.activeReminders && Array.isArray(remoteTracker.activeReminders)) {
                checkRegistrationDeadlines(remoteTracker.activeReminders);
            }

        } catch (error) {
            console.error('Error during cache synchronization and deadline check:', error);
            // Fallback: load raids.json normally if tracker fails
            await loadPastRaids();
        }
    }

    function checkRegistrationDeadlines(activeReminders) {
        if (!activeReminders || activeReminders.length === 0) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        activeReminders.forEach(reminder => {
            if (!reminder.regEndDate) return;

            // Parse YYYY-MM-DD to local midnight
            const parts = reminder.regEndDate.split('-');
            if (parts.length !== 3) return;

            const regDate = new Date(
                parseInt(parts[0], 10),
                parseInt(parts[1], 10) - 1,
                parseInt(parts[2], 10)
            );
            regDate.setHours(0, 0, 0, 0);

            // Compute difference in days
            const diffTime = regDate.getTime() - today.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

            // exactly 1 day prior
            if (diffDays === 1) {
                const storageKey = `ev_alert_sent_${reminder.raidNum}`;
                if (!localStorage.getItem(storageKey)) {
                    // Trigger warning
                    triggerDeadlineNotification(reminder.raidNum, reminder.regEndDate);
                    // Commit token flag to localStorage to prevent redundant notifications
                    localStorage.setItem(storageKey, 'true');
                }
            }
        });
    }

    function triggerDeadlineNotification(raidNum, regEndDate) {
        let raidTitle = "Upcoming Raid";
        let raidVenue = "See details";

        if (pastRaidsData) {
            const raid = pastRaidsData.find(r => r.Raid_Num === raidNum);
            if (raid) {
                raidTitle = raid.title;
                raidVenue = raid.venue;
            }
        }

        const notificationTitle = "Raid Registration Deadline!";
        const notificationBody = `Registration for "${raidTitle}" closes tomorrow! Venue: ${raidVenue}.`;

        // 1. System Push notification (HTML5 API)
        if ("Notification" in window) {
            if (Notification.permission === "granted") {
                showSystemNotification(notificationTitle, notificationBody, raidNum);
            } else if (Notification.permission !== "denied") {
                Notification.requestPermission().then(permission => {
                    if (permission === "granted") {
                        showSystemNotification(notificationTitle, notificationBody, raidNum);
                    }
                });
            }
        }

        // 2. Fallback Premium UI Toast notification
        showUiToastNotification(raidTitle, raidVenue, raidNum);
    }

    function showSystemNotification(title, body, raidNum) {
        try {
            const notification = new Notification(title, {
                body: body,
                icon: 'favicon.ico',
                tag: `raid-deadline-${raidNum}`
            });

            notification.onclick = function () {
                window.focus();
                window.location.hash = `#raid-${raidNum}`;
                scrollToRaid(raidNum);
                notification.close();
            };
        } catch (e) {
            console.error('System notification execution failed:', e);
        }
    }

    function showUiToastNotification(raidTitle, raidVenue, raidNum) {
        let toastContainer = document.getElementById('toast-notification-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-notification-container';
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }

        const toast = document.createElement('div');
        toast.className = 'premium-toast';
        toast.id = `deadline-toast-${raidNum}`;
        toast.setAttribute('role', 'alert');

        toast.innerHTML = `
            <div class="toast-glow"></div>
            <div class="toast-content-wrapper">
                <div class="toast-header">
                    <span class="toast-icon">⏳</span>
                    <span class="toast-title">Deadline Alert</span>
                    <button class="toast-close" aria-label="Close Alert">&times;</button>
                </div>
                <div class="toast-body">
                    <p class="toast-text">Registration for <strong>${escapeHtml(raidTitle)}</strong> closes tomorrow!</p>
                    <p class="toast-venue">📍 ${escapeHtml(raidVenue)}</p>
                </div>
                <div class="toast-actions">
                    <button class="toast-btn toast-btn-primary" data-raid-num="${raidNum}">View Raid</button>
                    <button class="toast-btn toast-btn-secondary toast-close-btn">Dismiss</button>
                </div>
            </div>
            <div class="toast-progress"></div>
        `;

        toastContainer.appendChild(toast);

        const closeBtn = toast.querySelector('.toast-close');
        const dismissBtn = toast.querySelector('.toast-close-btn');
        const viewBtn = toast.querySelector('.toast-btn-primary');

        const dismissToast = () => {
            toast.classList.add('toast-dismissing');
            toast.addEventListener('transitionend', () => {
                toast.remove();
                if (toastContainer.children.length === 0) {
                    toastContainer.remove();
                }
            });
        };

        closeBtn.addEventListener('click', dismissToast);
        dismissBtn.addEventListener('click', dismissToast);
        viewBtn.addEventListener('click', () => {
            window.location.hash = `#raid-${raidNum}`;
            scrollToRaid(raidNum);
            dismissToast();
        });

        // Auto dismiss after 12 seconds
        const autoDismissTimer = setTimeout(dismissToast, 12000);

        toast.addEventListener('mouseenter', () => {
            toast.querySelector('.toast-progress').style.animationPlayState = 'paused';
            clearTimeout(autoDismissTimer);
        });

        toast.addEventListener('mouseleave', () => {
            toast.querySelector('.toast-progress').style.animationPlayState = 'running';
            setTimeout(dismissToast, 6000);
        });
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /* ==========================================================================
       8. Central Database Authentication, Roles, Event Proposals & Review Dashboard
       ========================================================================== */
    let supabaseClient = null;
    let currentSessionUser = null;
    let currentUserRole = 'user'; // 'admin' | 'mod' | 'user'
    let currentReviewFilter = 'pending';
    let currentSubmissionsList = [];
    let communityUsersList = [];

    // Modal Display Helpers
    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        // Restore body scroll if no other custom modal is open
        const anyOpen = document.querySelectorAll('.custom-modal.open, .calendar-modal.open');
        if (anyOpen.length === 0) {
            document.body.style.overflow = '';
        }
    }

    function showModalAlert(alertElementId, message, type = 'error') {
        const alertBox = document.getElementById(alertElementId);
        if (!alertBox) return;
        alertBox.className = `modal-alert ${type}`;
        alertBox.innerText = message;
        alertBox.style.display = 'block';
    }

    function clearModalAlert(alertElementId) {
        const alertBox = document.getElementById(alertElementId);
        if (!alertBox) return;
        alertBox.style.display = 'none';
        alertBox.innerText = '';
    }

    // Initialize Supabase Client & Setup Event Listeners
    function initSupabaseAuth() {
        const env = window.__ENV || {};
        const supabaseUrl = env.SUPABASE_URL || 'https://bennnocwssmcpiqradvc.supabase.co';
        const supabaseKey = env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlbm5ub2N3c3NtY3BpcXJhZHZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3Mjk0MjAsImV4cCI6MjEwNTMwNTQyMH0.fOi4e7zdQDkPGA94a9__MgN_Q4u57Pj4-fBl4zz56Bc';

        if (window.supabase && window.supabase.createClient) {
            try {
                supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey, {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true
                    }
                });
            } catch (err) {
                console.error("Failed to initialize Supabase client:", err);
            }
        } else {
            console.warn("Supabase library not loaded. Authentication features run with placeholder fallback.");
        }

        // Global modal close buttons & backdrop click handlers
        document.querySelectorAll('[data-close-modal]').forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                e.preventDefault();
                const targetModalId = trigger.getAttribute('data-close-modal');
                closeModal(targetModalId);
            });
        });

        // Close on Escape key
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const openModals = document.querySelectorAll('.custom-modal.open');
                openModals.forEach(m => closeModal(m.id));
            }
        });

        // Desktop Floating Auth Button
        const desktopAuthBtn = document.getElementById('desktop-auth-btn');
        if (desktopAuthBtn) {
            desktopAuthBtn.addEventListener('click', () => {
                if (currentSessionUser) {
                    openModal('dashboard-modal');
                } else {
                    openModal('auth-modal');
                }
            });
        }

        // Mobile Sidebar Auth Button
        const mobileAuthBtn = document.getElementById('mobile-auth-btn');
        if (mobileAuthBtn) {
            mobileAuthBtn.addEventListener('click', () => {
                closeMobileMenu();
                if (currentSessionUser) {
                    openModal('dashboard-modal');
                } else {
                    openModal('auth-modal');
                }
            });
        }

        // Auth Tabs Toggle (Login / Register / Forgot Password)
        const authTabs = document.querySelectorAll('.auth-tab-btn');
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        const forgotForm = document.getElementById('forgot-form');
        const authModalTitle = document.getElementById('auth-modal-title');
        const oauthDivider = document.getElementById('oauth-divider');
        const googleLoginBtn = document.getElementById('google-login-btn');

        authTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                authTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                clearModalAlert('auth-alert');

                const targetTab = tab.getAttribute('data-auth-tab');
                if (targetTab === 'login') {
                    if (loginForm) loginForm.style.display = 'flex';
                    if (registerForm) registerForm.style.display = 'none';
                    if (forgotForm) forgotForm.style.display = 'none';
                    if (oauthDivider) oauthDivider.style.display = 'flex';
                    if (googleLoginBtn) googleLoginBtn.style.display = 'flex';
                    if (authModalTitle) authModalTitle.innerText = 'Sign In to Event Raiders';
                } else if (targetTab === 'register') {
                    if (loginForm) loginForm.style.display = 'none';
                    if (registerForm) registerForm.style.display = 'flex';
                    if (forgotForm) forgotForm.style.display = 'none';
                    if (oauthDivider) oauthDivider.style.display = 'flex';
                    if (googleLoginBtn) googleLoginBtn.style.display = 'flex';
                    if (authModalTitle) authModalTitle.innerText = 'Create Raider Account';
                } else if (targetTab === 'forgot') {
                    if (loginForm) loginForm.style.display = 'none';
                    if (registerForm) registerForm.style.display = 'none';
                    if (forgotForm) forgotForm.style.display = 'flex';
                    if (oauthDivider) oauthDivider.style.display = 'none';
                    if (googleLoginBtn) googleLoginBtn.style.display = 'none';
                    if (authModalTitle) authModalTitle.innerText = 'Reset Account Password';
                }
            });
        });

        // Google OAuth Sign In
        if (googleLoginBtn) {
            googleLoginBtn.addEventListener('click', async () => {
                clearModalAlert('auth-alert');

                if (window.location.protocol === 'file:') {
                    showModalAlert('auth-alert', 'Google Sign-In requires http:// or https:// (e.g. running via Live Server or hosted on GitHub Pages). Google does not allow redirects to local file:// URLs.', 'error');
                    return;
                }

                if (!supabaseClient) {
                    showModalAlert('auth-alert', 'Database connection not available.');
                    return;
                }

                const originalBtnHtml = googleLoginBtn.innerHTML;
                googleLoginBtn.disabled = true;
                googleLoginBtn.innerHTML = `<span>Connecting to Google...</span>`;

                try {
                    const redirectUrl = window.location.origin + window.location.pathname;
                    const { error } = await supabaseClient.auth.signInWithOAuth({
                        provider: 'google',
                        options: {
                            redirectTo: redirectUrl
                        }
                    });
                    if (error) throw error;
                } catch (err) {
                    console.error("Google login error:", err);
                    showModalAlert('auth-alert', err.message || 'Google sign in failed. Please try again.');
                    googleLoginBtn.disabled = false;
                    googleLoginBtn.innerHTML = originalBtnHtml;
                }
            });
        }

        // 1. Sign In Form Handler
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                clearModalAlert('auth-alert');
                const email = document.getElementById('login-email').value.trim();
                const password = document.getElementById('login-password').value;
                const submitBtn = document.getElementById('login-submit-btn');

                if (!email || !password) {
                    showModalAlert('auth-alert', 'Please enter both email and password.');
                    return;
                }

                if (!supabaseClient) {
                    showModalAlert('auth-alert', 'Database connection not available.');
                    return;
                }

                submitBtn.disabled = true;
                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<span>Signing In...</span>';

                try {
                    const { data, error } = await supabaseClient.auth.signInWithPassword({
                        email,
                        password
                    });

                    if (error) throw error;

                    showModalAlert('auth-alert', 'Login successful!', 'success');
                    await syncAuthState(data.session);

                    setTimeout(() => {
                        closeModal('auth-modal');
                        openModal('dashboard-modal');
                    }, 500);

                } catch (err) {
                    console.error("Login error:", err);
                    showModalAlert('auth-alert', err.message || 'Login failed. Please verify credentials.');
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }
            });
        }

        // 2. Register Form Handler
        if (registerForm) {
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                clearModalAlert('auth-alert');

                const fullName = document.getElementById('reg-name').value.trim();
                const studentId = document.getElementById('reg-student-id').value.trim();
                const department = document.getElementById('reg-dept').value;
                const bloodGroup = document.getElementById('reg-blood').value;
                const email = document.getElementById('reg-email').value.trim();
                const password = document.getElementById('reg-password').value;
                const submitBtn = document.getElementById('register-submit-btn');

                if (!/^[0-9]+$/.test(studentId)) {
                    showModalAlert('auth-alert', 'Student ID must contain only digits.');
                    return;
                }

                if (!supabaseClient) {
                    showModalAlert('auth-alert', 'Database connection not available.');
                    return;
                }

                submitBtn.disabled = true;
                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<span>Creating Account...</span>';

                try {
                    const { data, error } = await supabaseClient.auth.signUp({
                        email,
                        password,
                        options: {
                            data: {
                                full_name: fullName,
                                student_id: studentId,
                                department: department,
                                blood_group: bloodGroup || null
                            }
                        }
                    });

                    if (error) throw error;

                    // Tag user profile with 'events' project
                    try {
                        await supabaseClient.rpc('add_project_tag', { tag: 'events' });
                    } catch (pe) {
                        // Optional trigger fallback
                    }

                    if (data && data.session) {
                        showModalAlert('auth-alert', 'Registration successful! Logging you in...', 'success');
                        await syncAuthState(data.session);
                        setTimeout(() => {
                            closeModal('auth-modal');
                            openModal('dashboard-modal');
                        }, 800);
                    } else {
                        showModalAlert('auth-alert', 'Registration successful! Please check your email inbox to verify your account, or sign in.', 'success');
                    }

                } catch (err) {
                    console.error("Registration error:", err);
                    showModalAlert('auth-alert', err.message || 'Registration failed.');
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }
            });
        }

        // 3. Forgot Password Form Handler
        if (forgotForm) {
            forgotForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                clearModalAlert('auth-alert');
                const email = document.getElementById('forgot-email').value.trim();
                const submitBtn = document.getElementById('forgot-submit-btn');

                if (!email) {
                    showModalAlert('auth-alert', 'Please enter your account email.');
                    return;
                }

                if (!supabaseClient) {
                    showModalAlert('auth-alert', 'Database connection not available.');
                    return;
                }

                submitBtn.disabled = true;
                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<span>Sending Link...</span>';

                try {
                    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
                        redirectTo: window.location.origin + window.location.pathname
                    });
                    if (error) throw error;
                    showModalAlert('auth-alert', 'Password reset email sent! Check your inbox and spam folder.', 'success');
                } catch (err) {
                    console.error("Forgot password error:", err);
                    showModalAlert('auth-alert', err.message || 'Failed to send reset link.');
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }
            });
        }

        // 4. Log Out Handler
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                if (supabaseClient) {
                    try {
                        await supabaseClient.auth.signOut();
                    } catch (err) {
                        console.warn("Sign out error:", err);
                    }
                }
                currentSessionUser = null;
                currentUserRole = 'user';
                closeModal('dashboard-modal');
                updateAuthUI();
                filterAndRenderRaids();
            });
        }

        // 5. Dashboard Action Triggers
        const dashProposeBtn = document.getElementById('dash-propose-event-btn');
        if (dashProposeBtn) {
            dashProposeBtn.addEventListener('click', () => {
                closeModal('dashboard-modal');
                openEventFormModal('new');
            });
        }

        const dashReviewBtn = document.getElementById('dash-review-btn');
        if (dashReviewBtn) {
            dashReviewBtn.addEventListener('click', () => {
                closeModal('dashboard-modal');
                openReviewDashboardModal();
            });
        }

        const dashModsBtn = document.getElementById('dash-mods-btn');
        if (dashModsBtn) {
            dashModsBtn.addEventListener('click', () => {
                closeModal('dashboard-modal');
                openModManagementModal();
            });
        }

        // 6. Sub-Events Repeater (+ Add Sub-Event)
        const addSubEventBtn = document.getElementById('add-sub-event-btn');
        if (addSubEventBtn) {
            addSubEventBtn.addEventListener('click', () => {
                addSubEventRow('', '');
            });
        }

        // 7. Event Proposal / Edit Form Handler
        const raidSubmissionForm = document.getElementById('raid-submission-form');
        if (raidSubmissionForm) {
            raidSubmissionForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                clearModalAlert('event-form-alert');

                if (!currentSessionUser) {
                    showModalAlert('event-form-alert', 'You must be logged in to submit event proposals.');
                    return;
                }

                const submissionType = document.getElementById('form-submission-type').value;
                const raidNum = parseInt(document.getElementById('form-raid-num').value, 10);
                const title = document.getElementById('form-title').value.trim();
                const type = document.getElementById('form-type').value;
                const status = document.getElementById('form-status').value;
                const dateRange = document.getElementById('form-date-range').value.trim();
                const startDate = document.getElementById('form-start-date').value;
                const endDate = document.getElementById('form-end-date').value;
                const regEndDate = document.getElementById('form-reg-end-date').value;
                const venue = document.getElementById('form-venue').value.trim();
                const city = document.getElementById('form-city').value.trim();
                const isOnline = document.getElementById('form-is-online').checked;
                const outsideDhaka = document.getElementById('form-outside-dhaka').checked;
                const fee = document.getElementById('form-fee').value.trim() || 'Free';
                const details = document.getElementById('form-details').value.trim();
                const submitterNote = document.getElementById('form-submitter-note').value.trim();

                // Collect sub-events
                const subEvents = [];
                const subRows = document.querySelectorAll('#sub-events-repeater .sub-event-row');
                subRows.forEach(row => {
                    const st = row.querySelector('.sub-event-title-input').value.trim();
                    const sd = row.querySelector('.sub-event-details-input').value.trim();
                    if (st) {
                        subEvents.push({ title: st, details: sd });
                    }
                });

                // Collect links
                const links = {};
                const webLink = document.getElementById('form-link-website').value.trim();
                const regLink = document.getElementById('form-link-registration').value.trim();
                const fbLink = document.getElementById('form-link-facebook').value.trim();
                const notesLink = document.getElementById('form-link-notes').value.trim();

                if (webLink) links['Event Website'] = webLink;
                if (regLink) links['Registration'] = regLink;
                if (fbLink) links['Facebook Event'] = fbLink;
                if (notesLink) links['notes'] = notesLink;

                const raidData = {
                    Raid_Num: raidNum,
                    title: title,
                    Status: status,
                    Type: type,
                    dateRange: dateRange,
                    startDate: startDate,
                    endDate: endDate,
                    RegEndDate: regEndDate || endDate,
                    venue: venue,
                    fee: fee,
                    details: details,
                    subEvents: subEvents,
                    links: links,
                    OutsideDhaka: outsideDhaka,
                    IsOnline: isOnline
                };
                if (city) raidData.city = city;

                const submitBtn = document.getElementById('submit-event-btn');
                submitBtn.disabled = true;
                const originalBtnText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<span>Submitting Proposal...</span>';

                try {
                    if (!supabaseClient) throw new Error("Database not connected.");

                    const payload = {
                        user_id: currentSessionUser.id,
                        user_email: currentSessionUser.email,
                        user_name: currentSessionUser.full_name || currentSessionUser.email,
                        submission_type: submissionType,
                        raid_num: raidNum,
                        data: raidData,
                        status: 'pending',
                        review_notes: submitterNote,
                        created_at: new Date().toISOString()
                    };

                    const { error } = await supabaseClient
                        .from('event_submissions')
                        .insert([payload]);

                    if (error) {
                        // Check if table missing
                        if (error.code === '42P01' || (error.message && error.message.includes('does not exist'))) {
                            throw new Error("The 'event_submissions' table does not exist in Supabase yet. Please run doc/db/event_raids_schema.sql in your Supabase SQL Editor.");
                        }
                        throw error;
                    }

                    showModalAlert('event-form-alert', 'Proposal submitted successfully! It is now pending approval by admins/mods.', 'success');
                    setTimeout(() => {
                        closeModal('event-form-modal');
                        loadUserSubmissions();
                    }, 1200);

                } catch (err) {
                    console.error("Submission error:", err);
                    showModalAlert('event-form-alert', err.message || 'Failed to submit event proposal.');
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnText;
                }
            });
        }

        // 8. Review Dashboard Filter Tabs
        document.querySelectorAll('.review-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.review-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentReviewFilter = btn.getAttribute('data-status-filter');
                renderSubmissionsList();
            });
        });

        // 9. Download & Copy raids.json Export Buttons
        const downloadRaidsBtn = document.getElementById('download-raids-json-btn');
        if (downloadRaidsBtn) {
            downloadRaidsBtn.addEventListener('click', () => {
                const updatedJson = generateUpdatedRaidsJson();
                const blob = new Blob([updatedJson], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'raids.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });
        }

        const copyRaidsBtn = document.getElementById('copy-raids-json-btn');
        if (copyRaidsBtn) {
            copyRaidsBtn.addEventListener('click', () => {
                const updatedJson = generateUpdatedRaidsJson();
                navigator.clipboard.writeText(updatedJson).then(() => {
                    const originalText = copyRaidsBtn.innerHTML;
                    copyRaidsBtn.innerHTML = `<span>Copied!</span>`;
                    setTimeout(() => { copyRaidsBtn.innerHTML = originalText; }, 2000);
                });
            });
        }

        // 10. Mod User Search Filter
        const modSearchInput = document.getElementById('mod-user-search-input');
        if (modSearchInput) {
            modSearchInput.addEventListener('input', () => {
                renderCommunityUsersList(modSearchInput.value.trim().toLowerCase());
            });
        }

        // Initial Session Retrieval
        if (supabaseClient) {
            supabaseClient.auth.getSession().then(({ data }) => {
                if (data && data.session) {
                    syncAuthState(data.session);
                } else {
                    updateAuthUI();
                }
            }).catch(err => {
                console.warn("Could not retrieve initial session:", err);
                updateAuthUI();
            });

            supabaseClient.auth.onAuthStateChange(async (event, session) => {
                if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
                    // Clean OAuth callback hash/search parameters from URL
                    if (window.location.search.includes('code=') || window.location.hash.includes('access_token=')) {
                        try {
                            const cleanHash = (window.location.hash && !window.location.hash.includes('access_token=')) ? window.location.hash : (window.location.hash.startsWith('#') && !window.location.hash.includes('=') ? window.location.hash : '');
                            window.history.replaceState(null, document.title, window.location.pathname + cleanHash);
                        } catch (e) {}
                    }
                }
                await syncAuthState(session);
            });
        } else {
            updateAuthUI();
        }
    }

    // Sync Authentication State & Fetch Role from Supabase
    async function syncAuthState(session) {
        if (!session || !session.user) {
            currentSessionUser = null;
            currentUserRole = 'user';
            updateAuthUI();
            filterAndRenderRaids();
            return;
        }

        const user = session.user;
        let profile = null;
        let role = 'user';

        if (supabaseClient) {
            // 1. Fetch user profile
            try {
                const { data: profData } = await supabaseClient
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .maybeSingle();
                if (profData) {
                    profile = profData;
                    // Tag user with 'events' project if missing
                    if (!profile.project_tags || !profile.project_tags.includes('events')) {
                        try {
                            await supabaseClient.rpc('add_project_tag', { tag: 'events' });
                        } catch (te) {}
                    }
                }
            } catch (pe) {
                console.warn("Profile query failed:", pe);
            }

            // 2. Fetch project role from event_roles table
            try {
                const { data: roleData, error: roleError } = await supabaseClient
                    .from('event_roles')
                    .select('role')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (!roleError && roleData && roleData.role) {
                    role = roleData.role;
                } else {
                    // Check fallback tag in profiles
                    if (profile && Array.isArray(profile.project_tags)) {
                        if (profile.project_tags.includes('events_admin') || profile.project_tags.includes('admin')) {
                            role = 'admin';
                        } else if (profile.project_tags.includes('events_mod') || profile.project_tags.includes('mod')) {
                            role = 'mod';
                        }
                    }
                }
            } catch (re) {
                console.warn("Role query failed:", re);
            }
        }

        const metadata = user.user_metadata || {};
        const avatarUrl = metadata.avatar_url || metadata.picture || (profile && profile.avatar_url) || null;
        currentSessionUser = {
            id: user.id,
            email: user.email,
            full_name: (profile && profile.full_name) || metadata.full_name || metadata.name || user.email.split('@')[0],
            student_id: (profile && profile.student_id) || metadata.student_id || 'OAUTH_USER',
            department: (profile && profile.department) || metadata.department || 'General',
            blood_group: (profile && profile.blood_group) || metadata.blood_group || '',
            avatar_url: avatarUrl
        };
        currentUserRole = role;

        updateAuthUI();
        loadUserSubmissions();

        if (currentUserRole === 'admin' || currentUserRole === 'mod') {
            updateStaffBadgeCount();
        }

        // Re-render raids to show "Suggest Edit" buttons on cards
        filterAndRenderRaids();
    }

    // Update Floating Desktop and Mobile Navigation Auth Button States
    function updateAuthUI() {
        const desktopAuthBtn = document.getElementById('desktop-auth-btn');
        const desktopAuthLabel = document.getElementById('desktop-auth-label');
        const mobileAuthLabel = document.getElementById('mobile-auth-label');

        const dashAvatar = document.getElementById('dash-avatar');
        const dashUserName = document.getElementById('dash-user-name');
        const dashUserEmail = document.getElementById('dash-user-email');
        const dashStudentId = document.getElementById('dash-student-id');
        const dashDept = document.getElementById('dash-dept');
        const dashRoleBadge = document.getElementById('dash-role-badge');
        const staffButtons = document.querySelectorAll('.staff-only');
        const adminButtons = document.querySelectorAll('.admin-only');

        if (currentSessionUser) {
            // Logged in: buttons become Dashboard
            if (desktopAuthBtn) {
                desktopAuthBtn.classList.add('is-logged-in');
                desktopAuthBtn.setAttribute('aria-label', `Open Dashboard (${currentSessionUser.full_name})`);
            }
            if (desktopAuthLabel) desktopAuthLabel.innerText = 'Dashboard';
            if (mobileAuthLabel) mobileAuthLabel.innerText = 'Dashboard';

            // Populate dashboard profile details
            const nameParts = currentSessionUser.full_name.split(' ');
            const initials = nameParts.map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U';

            if (dashAvatar) {
                if (currentSessionUser.avatar_url) {
                    dashAvatar.innerHTML = `<img src="${currentSessionUser.avatar_url}" alt="${currentSessionUser.full_name}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;" onerror="this.parentElement.innerText='${initials}'">`;
                } else {
                    dashAvatar.innerText = initials;
                }
            }
            if (dashUserName) dashUserName.innerText = currentSessionUser.full_name;
            if (dashUserEmail) dashUserEmail.innerText = currentSessionUser.email;
            if (dashStudentId) dashStudentId.innerText = `ID: ${currentSessionUser.student_id}`;
            if (dashDept) dashDept.innerText = `Dept: ${currentSessionUser.department}`;

            if (dashRoleBadge) {
                dashRoleBadge.className = `role-badge role-${currentUserRole}`;
                dashRoleBadge.innerText = currentUserRole === 'admin' ? 'Admin' : (currentUserRole === 'mod' ? 'Moderator' : 'Member');
            }

            // Role visibility toggles
            staffButtons.forEach(b => {
                b.style.display = (currentUserRole === 'admin' || currentUserRole === 'mod') ? 'flex' : 'none';
            });
            adminButtons.forEach(b => {
                b.style.display = (currentUserRole === 'admin') ? 'flex' : 'none';
            });

        } else {
            // Logged out: buttons become Login
            if (desktopAuthBtn) {
                desktopAuthBtn.classList.remove('is-logged-in');
                desktopAuthBtn.setAttribute('aria-label', 'Account Login');
            }
            if (desktopAuthLabel) desktopAuthLabel.innerText = 'Login';
            if (mobileAuthLabel) mobileAuthLabel.innerText = 'Login';

            staffButtons.forEach(b => b.style.display = 'none');
            adminButtons.forEach(b => b.style.display = 'none');
        }
    }

    // Load logged-in user's recent submissions for dashboard list
    async function loadUserSubmissions() {
        const listContainer = document.getElementById('user-submissions-list');
        if (!listContainer || !currentSessionUser || !supabaseClient) return;

        try {
            const { data, error } = await supabaseClient
                .from('event_submissions')
                .select('*')
                .eq('user_id', currentSessionUser.id)
                .order('created_at', { ascending: false })
                .limit(5);

            if (error || !data || data.length === 0) {
                listContainer.innerHTML = '<p class="empty-list-text">No submissions yet. Propose an event to get started!</p>';
                return;
            }

            listContainer.innerHTML = '';
            data.forEach(sub => {
                const item = document.createElement('div');
                item.className = 'dashboard-submission-item';
                item.style.padding = '0.5rem 0.75rem';
                item.style.background = 'var(--bg-secondary)';
                item.style.borderRadius = '6px';
                item.style.display = 'flex';
                item.style.justifyContent = 'space-between';
                item.style.alignItems = 'center';
                item.style.fontSize = '0.82rem';

                const statusColor = sub.status === 'approved' ? '#10b981' : (sub.status === 'rejected' ? '#ef4444' : 'var(--accent)');
                item.innerHTML = `
                    <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70%;">
                        <strong>${escapeHTML(sub.data ? sub.data.title : 'Raid')}</strong>
                        <div style="color: var(--text-muted); font-size: 0.75rem;">${sub.submission_type === 'update' ? `Edit to Raid #${sub.raid_num}` : 'New Raid'}</div>
                    </div>
                    <span style="color: ${statusColor}; font-weight: 700; text-transform: capitalize;">${escapeHTML(sub.status)}</span>
                `;
                listContainer.appendChild(item);
            });
        } catch (e) {
            listContainer.innerHTML = '<p class="empty-list-text">Unable to load submissions history.</p>';
        }
    }

    // Update pending badge count for admin/mods
    async function updateStaffBadgeCount() {
        if (!supabaseClient) return;
        try {
            const { count, error } = await supabaseClient
                .from('event_submissions')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');

            if (!error && count !== null) {
                const dashBadge = document.getElementById('pending-reviews-count-badge');
                const reviewBadge = document.getElementById('review-pending-badge');
                if (dashBadge) dashBadge.innerText = count;
                if (reviewBadge) reviewBadge.innerText = count;
            }
        } catch (e) {
            // Ignore badge count failure
        }
    }

    // Open Event Proposal / Edit Modal
    window.openEventFormModal = function (mode, existingRaid = null) {
        if (!currentSessionUser) {
            openModal('auth-modal');
            showModalAlert('auth-alert', 'Please sign in to propose an event or update raids.', 'info');
            return;
        }

        clearModalAlert('event-form-alert');
        const formModeTag = document.getElementById('event-form-mode-tag');
        const formTitle = document.getElementById('event-form-modal-title');
        const formSubmittionType = document.getElementById('form-submission-type');
        const formTargetRaidNum = document.getElementById('form-target-raid-num');

        const raidNumInput = document.getElementById('form-raid-num');
        const titleInput = document.getElementById('form-title');
        const typeSelect = document.getElementById('form-type');
        const statusSelect = document.getElementById('form-status');
        const dateRangeInput = document.getElementById('form-date-range');
        const startDateInput = document.getElementById('form-start-date');
        const endDateInput = document.getElementById('form-end-date');
        const regEndDateInput = document.getElementById('form-reg-end-date');
        const venueInput = document.getElementById('form-venue');
        const cityInput = document.getElementById('form-city');
        const isOnlineCheck = document.getElementById('form-is-online');
        const outsideDhakaCheck = document.getElementById('form-outside-dhaka');
        const feeInput = document.getElementById('form-fee');
        const detailsInput = document.getElementById('form-details');

        const webInput = document.getElementById('form-link-website');
        const regLinkInput = document.getElementById('form-link-registration');
        const fbInput = document.getElementById('form-link-facebook');
        const notesInput = document.getElementById('form-link-notes');
        const noteInput = document.getElementById('form-submitter-note');

        const subEventsRepeater = document.getElementById('sub-events-repeater');
        if (subEventsRepeater) subEventsRepeater.innerHTML = '';

        if (mode === 'update' && existingRaid) {
            if (formModeTag) formModeTag.innerText = `Edit Proposal • Raid #${existingRaid.Raid_Num}`;
            if (formTitle) formTitle.innerText = `Propose Updates for Raid #${existingRaid.Raid_Num}`;
            if (formSubmittionType) formSubmittionType.value = 'update';
            if (formTargetRaidNum) formTargetRaidNum.value = existingRaid.Raid_Num;

            raidNumInput.value = existingRaid.Raid_Num;
            titleInput.value = existingRaid.title || '';
            typeSelect.value = existingRaid.Type || 'Hackathons';
            statusSelect.value = existingRaid.Status || 'Future';
            dateRangeInput.value = existingRaid.dateRange || '';
            startDateInput.value = existingRaid.startDate || '';
            endDateInput.value = existingRaid.endDate || '';
            regEndDateInput.value = existingRaid.RegEndDate || existingRaid.endDate || '';
            venueInput.value = existingRaid.venue || '';
            cityInput.value = existingRaid.city || '';
            isOnlineCheck.checked = Boolean(existingRaid.IsOnline);
            outsideDhakaCheck.checked = Boolean(existingRaid.OutsideDhaka);
            feeInput.value = existingRaid.fee || '';
            detailsInput.value = existingRaid.details || '';

            const links = existingRaid.links || {};
            webInput.value = links['Event Website'] || '';
            regLinkInput.value = links['Registration'] || links['CTF Registration'] || '';
            fbInput.value = links['Facebook Event'] || links['Facebook Post'] || '';
            notesInput.value = links['notes'] || '';
            noteInput.value = '';

            if (Array.isArray(existingRaid.subEvents) && existingRaid.subEvents.length > 0) {
                existingRaid.subEvents.forEach(se => addSubEventRow(se.title, se.details));
            } else {
                addSubEventRow('', '');
            }

        } else {
            // New raid proposal
            let nextNum = 1;
            if (pastRaidsData && pastRaidsData.length > 0) {
                const nums = pastRaidsData.map(r => r.Raid_Num).filter(n => typeof n === 'number');
                if (nums.length > 0) nextNum = Math.max(...nums) + 1;
            }

            if (formModeTag) formModeTag.innerText = 'New Campaign Proposal';
            if (formTitle) formTitle.innerText = 'Propose New Raid Campaign';
            if (formSubmittionType) formSubmittionType.value = 'new';
            if (formTargetRaidNum) formTargetRaidNum.value = nextNum;

            raidNumInput.value = nextNum;
            titleInput.value = '';
            typeSelect.value = 'Hackathons';
            statusSelect.value = 'Future';
            dateRangeInput.value = '';
            startDateInput.value = '';
            endDateInput.value = '';
            regEndDateInput.value = '';
            venueInput.value = '';
            cityInput.value = '';
            isOnlineCheck.checked = false;
            outsideDhakaCheck.checked = false;
            feeInput.value = 'Free';
            detailsInput.value = '';

            webInput.value = '';
            regLinkInput.value = '';
            fbInput.value = '';
            notesInput.value = '';
            noteInput.value = '';

            addSubEventRow('', '');
        }

        openModal('event-form-modal');
    };

    // Helper: Add dynamic sub-event row in repeater
    function addSubEventRow(title = '', details = '') {
        const repeater = document.getElementById('sub-events-repeater');
        if (!repeater) return;

        const row = document.createElement('div');
        row.className = 'sub-event-row';
        row.innerHTML = `
            <div class="sub-event-row-top">
                <input type="text" class="form-input sub-event-title-input" placeholder="Sub-event / Track title (e.g. 48-Hour CTF)" value="${escapeHTML(title)}" required>
                <button type="button" class="remove-sub-event-btn" title="Remove sub-event">&times;</button>
            </div>
            <textarea class="form-input form-textarea sub-event-details-input" rows="2" placeholder="Sub-event description or schedule details...">${escapeHTML(details)}</textarea>
        `;

        row.querySelector('.remove-sub-event-btn').addEventListener('click', () => {
            row.remove();
        });

        repeater.appendChild(row);
    }

    // Open Review Dashboard Modal (Staff Only)
    async function openReviewDashboardModal() {
        if (currentUserRole !== 'admin' && currentUserRole !== 'mod') {
            alert('Access restricted: Only guild admins and moderators can access the Review Dashboard.');
            return;
        }

        openModal('review-dashboard-modal');
        await fetchSubmissions();
        renderSubmissionsList();
    }

    // Fetch Submissions from Supabase
    async function fetchSubmissions() {
        const container = document.getElementById('review-submissions-container');
        if (!container || !supabaseClient) return;

        container.innerHTML = '<div class="review-loading-state">Loading submissions from database...</div>';
        clearModalAlert('review-dashboard-alert');

        try {
            const { data, error } = await supabaseClient
                .from('event_submissions')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                if (error.code === '42P01' || (error.message && error.message.includes('does not exist'))) {
                    container.innerHTML = `
                        <div style="padding: 1.5rem; text-align: center; color: var(--text-muted); background: var(--bg-tertiary); border-radius: 12px; border: 1px dashed var(--border-color);">
                            <p style="font-size: 1.1rem; color: var(--text-primary); margin-bottom: 0.5rem;">Database Table Not Found</p>
                            <p style="font-size: 0.9rem; margin-bottom: 1rem;">The <code>event_submissions</code> table has not been initialized in Supabase yet.</p>
                            <p style="font-size: 0.85rem;">Run the migration script <strong>doc/db/event_raids_schema.sql</strong> in your Supabase SQL Editor to enable real-time reviews.</p>
                        </div>
                    `;
                    return;
                }
                throw error;
            }

            currentSubmissionsList = data || [];

            // Update badge counts
            const pendingCount = currentSubmissionsList.filter(s => s.status === 'pending').length;
            const approvedCount = currentSubmissionsList.filter(s => s.status === 'approved').length;
            const rejectedCount = currentSubmissionsList.filter(s => s.status === 'rejected').length;

            const pBadge = document.getElementById('review-pending-badge');
            const aBadge = document.getElementById('review-approved-badge');
            const rBadge = document.getElementById('review-rejected-badge');
            if (pBadge) pBadge.innerText = pendingCount;
            if (aBadge) aBadge.innerText = approvedCount;
            if (rBadge) rBadge.innerText = rejectedCount;

            const dashBadge = document.getElementById('pending-reviews-count-badge');
            if (dashBadge) dashBadge.innerText = pendingCount;

        } catch (err) {
            console.error("Fetch submissions error:", err);
            container.innerHTML = `<p class="empty-list-text" style="color: #ef4444;">Failed to load submissions: ${escapeHTML(err.message)}</p>`;
        }
    }

    // Render Submissions List based on current status filter
    function renderSubmissionsList() {
        const container = document.getElementById('review-submissions-container');
        if (!container) return;

        const filtered = currentSubmissionsList.filter(s => s.status === currentReviewFilter);

        if (filtered.length === 0) {
            container.innerHTML = `<p class="empty-list-text">No ${currentReviewFilter} submissions found.</p>`;
            return;
        }

        container.innerHTML = '';

        filtered.forEach(sub => {
            const card = document.createElement('div');
            card.className = 'review-card';

            const createdDate = sub.created_at ? new Date(sub.created_at).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : 'Recent';

            const raidData = sub.data || {};
            const isUpdate = sub.submission_type === 'update';
            const badgeClass = isUpdate ? 'type-update' : 'type-new';
            const badgeLabel = isUpdate ? `Update: Raid #${sub.raid_num}` : 'New Raid Proposal';

            // Find original raid for diff if updating
            let originalRaid = null;
            if (isUpdate && pastRaidsData) {
                originalRaid = pastRaidsData.find(r => r.Raid_Num === sub.raid_num);
            }

            let diffHtml = '';
            if (isUpdate && originalRaid) {
                diffHtml = buildDiffTable(originalRaid, raidData);
            } else {
                diffHtml = buildNewRaidSummary(raidData);
            }

            let actionsHtml = '';
            if (sub.status === 'pending') {
                actionsHtml = `
                    <div class="review-actions-row">
                        <button type="button" class="btn-reject" data-reject-id="${sub.id}">Reject</button>
                        <button type="button" class="btn-approve" data-approve-id="${sub.id}">Approve Proposal</button>
                    </div>
                `;
            } else {
                actionsHtml = `
                    <div style="font-size: 0.8rem; color: var(--text-muted); text-align: right;">
                        Status: <strong style="text-transform: capitalize; color: ${sub.status === 'approved' ? '#10b981' : '#ef4444'}">${sub.status}</strong>
                        ${sub.reviewed_at ? ` on ${new Date(sub.reviewed_at).toLocaleDateString()}` : ''}
                        ${sub.review_notes ? `<br>Note: <em>${escapeHTML(sub.review_notes)}</em>` : ''}
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="review-card-header">
                    <div class="review-card-title-group">
                        <h4>${escapeHTML(raidData.title || 'Untitled Raid')}</h4>
                        <p class="review-submitter-meta">
                            Submitted by <strong>${escapeHTML(sub.user_name || sub.user_email)}</strong> (${escapeHTML(sub.user_email)}) • ${createdDate}
                        </p>
                    </div>
                    <span class="review-type-badge ${badgeClass}">${badgeLabel}</span>
                </div>

                ${sub.review_notes ? `<div style="font-size: 0.85rem; color: var(--text-secondary); background: var(--bg-secondary); padding: 0.5rem 0.75rem; border-radius: 6px;"><strong>Submitter Note:</strong> ${escapeHTML(sub.review_notes)}</div>` : ''}

                <div class="review-details-box">
                    ${diffHtml}
                </div>

                ${actionsHtml}
            `;

            // Action button listeners
            const approveBtn = card.querySelector('[data-approve-id]');
            if (approveBtn) {
                approveBtn.addEventListener('click', () => approveSubmission(sub));
            }

            const rejectBtn = card.querySelector('[data-reject-id]');
            if (rejectBtn) {
                rejectBtn.addEventListener('click', () => rejectSubmission(sub));
            }

            container.appendChild(card);
        });
    }

    // Helper: Build Side-by-Side Diff Table for Updates
    function buildDiffTable(oldRaid, newRaid) {
        const fields = [
            { label: 'Title', oldVal: oldRaid.title, newVal: newRaid.title },
            { label: 'Type', oldVal: oldRaid.Type, newVal: newRaid.Type },
            { label: 'Status', oldVal: oldRaid.Status, newVal: newRaid.Status },
            { label: 'Dates', oldVal: oldRaid.dateRange, newVal: newRaid.dateRange },
            { label: 'Start Date', oldVal: oldRaid.startDate, newVal: newRaid.startDate },
            { label: 'End Date', oldVal: oldRaid.endDate, newVal: newRaid.endDate },
            { label: 'Registration End', oldVal: oldRaid.RegEndDate, newVal: newRaid.RegEndDate },
            { label: 'Venue', oldVal: oldRaid.venue, newVal: newRaid.venue },
            { label: 'City', oldVal: oldRaid.city || '', newVal: newRaid.city || '' },
            { label: 'Fee', oldVal: oldRaid.fee, newVal: newRaid.fee },
            { label: 'Virtual / Online', oldVal: Boolean(oldRaid.IsOnline), newVal: Boolean(newRaid.IsOnline) },
            { label: 'Outside Dhaka', oldVal: Boolean(oldRaid.OutsideDhaka), newVal: Boolean(newRaid.OutsideDhaka) }
        ];

        let rows = '';
        fields.forEach(f => {
            const hasChanged = String(f.oldVal) !== String(f.newVal);
            rows += `
                <tr>
                    <th>${escapeHTML(f.label)}</th>
                    <td>
                        ${hasChanged ? `<span class="diff-val-old">${escapeHTML(String(f.oldVal || '-'))}</span> &rarr; ` : ''}
                        <span class="${hasChanged ? 'diff-val-new' : ''}">${escapeHTML(String(f.newVal || '-'))}</span>
                    </td>
                </tr>
            `;
        });

        return `
            <table class="review-diff-table">
                <tbody>${rows}</tbody>
            </table>
        `;
    }

    // Helper: Build New Raid Summary Table
    function buildNewRaidSummary(newRaid) {
        return `
            <table class="review-diff-table">
                <tbody>
                    <tr><th>Type</th><td>${escapeHTML(newRaid.Type || '-')}</td></tr>
                    <tr><th>Date Range</th><td>${escapeHTML(newRaid.dateRange || '-')} (${escapeHTML(newRaid.startDate || '')} to ${escapeHTML(newRaid.endDate || '')})</td></tr>
                    <tr><th>Registration</th><td>${escapeHTML(newRaid.RegEndDate || '-')}</td></tr>
                    <tr><th>Venue</th><td>${escapeHTML(newRaid.venue || '-')} ${newRaid.IsOnline ? '(Online)' : ''}</td></tr>
                    <tr><th>Fee</th><td>${escapeHTML(newRaid.fee || 'Free')}</td></tr>
                    <tr><th>Details</th><td>${escapeHTML(newRaid.details || '-')}</td></tr>
                    <tr><th>Sub-Events</th><td>${Array.isArray(newRaid.subEvents) ? newRaid.subEvents.map(s => `<strong>${escapeHTML(s.title)}</strong>`).join(', ') : 'None'}</td></tr>
                </tbody>
            </table>
        `;
    }

    // Approve a submission
    async function approveSubmission(submission) {
        if (!confirm(`Are you sure you want to approve "${submission.data ? submission.data.title : 'this submission'}"?`)) {
            return;
        }

        try {
            if (!supabaseClient) throw new Error("Database not connected.");

            const { error } = await supabaseClient
                .from('event_submissions')
                .update({
                    status: 'approved',
                    reviewer_id: currentSessionUser.id,
                    reviewer_email: currentSessionUser.email,
                    reviewed_at: new Date().toISOString()
                })
                .eq('id', submission.id);

            if (error) throw error;

            // Apply in-memory update so the active user sees the approved data immediately
            applyApprovedSubmissionToMemory(submission);

            showModalAlert('review-dashboard-alert', 'Submission approved successfully!', 'success');
            await fetchSubmissions();
            renderSubmissionsList();
            filterAndRenderRaids();

        } catch (err) {
            console.error("Approve error:", err);
            showModalAlert('review-dashboard-alert', err.message || 'Failed to approve submission.');
        }
    }

    // Reject a submission
    async function rejectSubmission(submission) {
        const reason = prompt("Enter a reason or feedback for rejection (optional):", "");
        if (reason === null) return; // User cancelled

        try {
            if (!supabaseClient) throw new Error("Database not connected.");

            const { error } = await supabaseClient
                .from('event_submissions')
                .update({
                    status: 'rejected',
                    reviewer_id: currentSessionUser.id,
                    reviewer_email: currentSessionUser.email,
                    review_notes: reason ? reason.trim() : submission.review_notes,
                    reviewed_at: new Date().toISOString()
                })
                .eq('id', submission.id);

            if (error) throw error;

            showModalAlert('review-dashboard-alert', 'Submission rejected.', 'info');
            await fetchSubmissions();
            renderSubmissionsList();

        } catch (err) {
            console.error("Reject error:", err);
            showModalAlert('review-dashboard-alert', err.message || 'Failed to reject submission.');
        }
    }

    // Apply approved submission directly into pastRaidsData
    function applyApprovedSubmissionToMemory(submission) {
        if (!pastRaidsData || !submission.data) return;

        if (submission.submission_type === 'update') {
            const index = pastRaidsData.findIndex(r => r.Raid_Num === submission.raid_num);
            if (index !== -1) {
                pastRaidsData[index] = Object.assign({}, pastRaidsData[index], submission.data);
            }
        } else {
            // New raid: prepend to list
            pastRaidsData.unshift(submission.data);
            // Sort by Raid_Num descending
            pastRaidsData.sort((a, b) => b.Raid_Num - a.Raid_Num);
        }
    }

    // Generate updated JSON formatted matching raids.json
    function generateUpdatedRaidsJson() {
        if (!pastRaidsData) return '[]';
        return JSON.stringify(pastRaidsData, null, 2);
    }

    // Open Mod Management Modal (Admin Only)
    async function openModManagementModal() {
        if (currentUserRole !== 'admin') {
            alert('Access restricted: Only Guild Admins can manage moderators.');
            return;
        }

        openModal('mod-management-modal');
        await fetchCommunityUsers();
        renderCommunityUsersList();
    }

    // Fetch Community Users from profiles & event_roles
    async function fetchCommunityUsers() {
        const listContainer = document.getElementById('mod-users-list');
        if (!listContainer || !supabaseClient) return;

        listContainer.innerHTML = '<div class="review-loading-state">Loading registered community members...</div>';
        clearModalAlert('mod-management-alert');

        try {
            // 1. Fetch profiles
            const { data: profiles, error: pError } = await supabaseClient
                .from('profiles')
                .select('id, full_name, email, student_id, department, project_tags')
                .order('created_at', { ascending: false })
                .limit(100);

            if (pError) throw pError;

            // 2. Fetch existing roles
            let roleMap = {};
            try {
                const { data: roles, error: rError } = await supabaseClient
                    .from('event_roles')
                    .select('user_id, role');

                if (!rError && roles) {
                    roles.forEach(r => { roleMap[r.user_id] = r.role; });
                }
            } catch (re) {
                console.warn("Could not query event_roles:", re);
            }

            communityUsersList = (profiles || []).map(p => {
                let userRole = roleMap[p.id] || 'user';
                // Tag check fallback
                if (userRole === 'user' && Array.isArray(p.project_tags)) {
                    if (p.project_tags.includes('events_admin') || p.project_tags.includes('admin')) userRole = 'admin';
                    else if (p.project_tags.includes('events_mod') || p.project_tags.includes('mod')) userRole = 'mod';
                }
                return {
                    id: p.id,
                    name: p.full_name || 'Member',
                    email: p.email,
                    student_id: p.student_id || 'N/A',
                    department: p.department || 'N/A',
                    role: userRole
                };
            });

        } catch (err) {
            console.error("Fetch community users error:", err);
            listContainer.innerHTML = `<p class="empty-list-text" style="color: #ef4444;">Failed to load users: ${escapeHTML(err.message)}</p>`;
        }
    }

    // Render Community Users in Mod Management Modal
    function renderCommunityUsersList(searchQuery = '') {
        const listContainer = document.getElementById('mod-users-list');
        if (!listContainer) return;

        let filtered = communityUsersList;
        if (searchQuery) {
            filtered = filtered.filter(u =>
                (u.name && u.name.toLowerCase().includes(searchQuery)) ||
                (u.email && u.email.toLowerCase().includes(searchQuery)) ||
                (u.student_id && String(u.student_id).toLowerCase().includes(searchQuery))
            );
        }

        if (filtered.length === 0) {
            listContainer.innerHTML = '<p class="empty-list-text">No community members matched your search.</p>';
            return;
        }

        listContainer.innerHTML = '';
        filtered.forEach(u => {
            const row = document.createElement('div');
            row.className = 'mod-user-row';

            const isCurrentUser = currentSessionUser && currentSessionUser.id === u.id;
            const isAdmin = u.role === 'admin';
            const isMod = u.role === 'mod';

            let actionButton = '';
            if (isAdmin) {
                actionButton = `<span class="role-badge role-admin">Admin</span>`;
            } else if (isCurrentUser) {
                actionButton = `<span class="role-badge role-admin">You (Admin)</span>`;
            } else {
                actionButton = `
                    <button type="button" class="btn-toggle-mod ${isMod ? 'is-mod' : 'not-mod'}" data-user-id="${u.id}" data-action="${isMod ? 'revoke' : 'promote'}">
                        ${isMod ? 'Revoke Mod' : 'Appoint Mod'}
                    </button>
                `;
            }

            row.innerHTML = `
                <div class="mod-user-details">
                    <h5 class="mod-user-name">${escapeHTML(u.name)}</h5>
                    <p class="mod-user-meta">${escapeHTML(u.email)} • ID: ${escapeHTML(u.student_id)} • Dept: ${escapeHTML(u.department)}</p>
                </div>
                <div class="mod-user-action">
                    ${actionButton}
                </div>
            `;

            const toggleBtn = row.querySelector('[data-user-id]');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', () => {
                    const makeMod = toggleBtn.getAttribute('data-action') === 'promote';
                    toggleModRole(u.id, makeMod);
                });
            }

            listContainer.appendChild(row);
        });
    }

    // Assign / Revoke Moderator Role in Supabase
    async function toggleModRole(userId, makeMod) {
        clearModalAlert('mod-management-alert');
        try {
            if (!supabaseClient) throw new Error("Database not connected.");

            const targetRole = makeMod ? 'mod' : 'user';

            const { error } = await supabaseClient
                .from('event_roles')
                .upsert({
                    user_id: userId,
                    role: targetRole,
                    assigned_by: currentSessionUser.id,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });

            if (error) {
                if (error.code === '42P01' || (error.message && error.message.includes('does not exist'))) {
                    throw new Error("The 'event_roles' table has not been initialized. Please run doc/db/event_raids_schema.sql in Supabase SQL Editor.");
                }
                throw error;
            }

            showModalAlert('mod-management-alert', `Moderator role ${makeMod ? 'appointed' : 'revoked'} successfully!`, 'success');
            await fetchCommunityUsers();
            const searchVal = document.getElementById('mod-user-search-input')?.value.trim().toLowerCase() || '';
            renderCommunityUsersList(searchVal);

        } catch (err) {
            console.error("Toggle mod role error:", err);
            showModalAlert('mod-management-alert', err.message || 'Failed to update moderator role.');
        }
    }

    /* ==========================================================================
       9. Initialize Application
       ========================================================================== */
    initializeTheme();
    initCalendar();
    initDropdownFilter();
    initPastRaidsToggle();
    initCacheAndNotifications();
    initSupabaseAuth();
    routePage();
});
