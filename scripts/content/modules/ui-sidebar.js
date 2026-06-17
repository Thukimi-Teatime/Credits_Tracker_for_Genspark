// ========================================
// UI Sidebar Module
// ========================================

(function () {
    const Logger = window.GensparkTracker.Utils.Logger;
    const UICommon = window.GensparkTracker.UI.Common;
    const State = window.GensparkTracker.State;
    const Config = window.GensparkTracker.Config;

    const Sidebar = {
        // Add Current Balance display above sidebar-footer
        addBalanceAboveSidebarFooter: function () {
            // Check if already added
            if (document.getElementById('balance-display-sidebar')) {
                return true;
            }

            let insertionPoint = null;
            let insertMethod = 'beforebegin';
            let stageUsed = 0;

            // --- Stage 1: Footer Strategy (Optimum position) ---
            insertionPoint = document.querySelector('.sidebar-footer');
            if (insertionPoint) {
                stageUsed = 1;
                insertMethod = 'beforebegin';
            }

            // --- Stage 2: Sidebar Strategy (Fallback to sidebar top) ---
            /*
            if (!insertionPoint) {
                insertionPoint = document.querySelector('.sidebar, [class*="sidebar"]');
                if (insertionPoint) {
                    stageUsed = 2;
                    insertMethod = 'afterbegin';
                }
            }
            */

            // --- Stage 3: Global Navigation Strategy (Last resort) ---
            /*
            if (!insertionPoint) {
                insertionPoint = document.querySelector('nav, [role="navigation"], footer, [role="contentinfo"]');
                if (insertionPoint) {
                    stageUsed = 3;
                    insertMethod = 'afterbegin'; // Prepend to whatever nav/footer we found
                }
            }
            */

            // If all stages failed
            if (!insertionPoint) {
                Logger.debugWarn('[Credit Tracker for Genspark] Sidebar: All Stages failed - cannot add balance display');
                Logger.logSidebarFailure();
                return false;
            }

            Logger.debugLog(`[Credit Tracker for Genspark] Sidebar: Stage ${stageUsed} identified for insertion`);

            // Create Main Dashboard Container
            const dashboardContainer = document.createElement('div');
            dashboardContainer.id = 'genspark-tracker-dashboard';
            dashboardContainer.style.cssText = `
                display: flex !important;
                flex-direction: column !important;
                gap: 8px !important;
                margin: 8px 8px 8px 2px !important;
                max-width: 90% !important;
            `;

            const cardStyle = `
                padding: 10px !important;
                text-align: center !important;
                color: white !important;
                background: rgba(0, 0, 0, 0.85) !important;
                border-radius: 5px !important;
                display: block !important;
                visibility: visible !important;
                position: relative !important;
                z-index: 1 !important;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
                box-sizing: border-box !important;
                width: 100% !important;
            `;

            // Card 1: Balance Display
            const balanceCard = document.createElement('div');
            balanceCard.id = 'balance-display-sidebar';
            balanceCard.style.cssText = cardStyle + ' cursor: pointer !important;';
            balanceCard.innerHTML = `
                <div id="balance-label-sidebar" style="font-size: 11px; margin-bottom: 4px; opacity: 0.8;">Renewal In</div>
                <div id="balance-value-sidebar" style="font-size: 16px; font-weight: bold;">---</div>
            `;

            // Hover effect for balance card
            balanceCard.addEventListener('mouseenter', () => {
                balanceCard.style.background = 'rgba(25, 25, 25, 0.95)';
                balanceCard.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.2)';
            });
            balanceCard.addEventListener('mouseleave', () => {
                balanceCard.style.background = 'rgba(0, 0, 0, 0.85)';
                balanceCard.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
            });

            // Click listener for mini menu
            balanceCard.addEventListener('click', (e) => {
                this.createMiniMenu(e.currentTarget);
            });

            // Card 2: Usage Graph Trigger
            const graphCard = document.createElement('div');
            graphCard.id = 'graph-trigger-sidebar';
            graphCard.style.cssText = cardStyle + ' cursor: pointer !important;';
            graphCard.innerHTML = `
                <div style="font-size: 13px; font-weight: bold; padding: 2px 0;">Usage Graph</div>
            `;

            // Hover effect for graph card
            graphCard.addEventListener('mouseenter', () => {
                graphCard.style.background = 'rgba(25, 25, 25, 0.95)';
                graphCard.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.2)';
            });
            graphCard.addEventListener('mouseleave', () => {
                graphCard.style.background = 'rgba(0, 0, 0, 0.85)';
                graphCard.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
            });

            // Add click listener to open graph
            graphCard.addEventListener('click', () => {
                if (window.GensparkTracker.UI.Graph) {
                    window.GensparkTracker.UI.Graph.toggleGraphPanel();
                }
            });

            dashboardContainer.appendChild(balanceCard);
            dashboardContainer.appendChild(graphCard);

            // Insert
            try {
                if (insertMethod === 'beforebegin') {
                    insertionPoint.insertAdjacentElement('beforebegin', dashboardContainer);
                } else if (insertMethod === 'prepend') {
                    insertionPoint.insertAdjacentElement('afterbegin', dashboardContainer);
                } else {
                    insertionPoint.appendChild(dashboardContainer);
                }
                Logger.debugLog(`[Credit Tracker for Genspark] Sidebar balance added successfully (Stage ${stageUsed})`);
                Logger.logSidebarSuccess(stageUsed);
                this.updateSidebarBalance();
                return true;
            } catch (error) {
                console.error('[Credit Tracker for Genspark] Failed to insert sidebar balance:', error);
                Logger.logSidebarFailure();
                return false;
            }
        },

        createMiniMenu: function (anchorElement) {
            // Remove existing menu if any
            const existingMenu = document.getElementById('genspark-sidebar-mini-menu');
            if (existingMenu) {
                existingMenu.remove();
            }

            const menu = document.createElement('div');
            menu.id = 'genspark-sidebar-mini-menu';
            menu.style.cssText = `
                position: absolute;
                background: #0f172a;
                border: 1px solid #1e293b;
                border-radius: 8px;
                padding: 6px;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5), 0 0 10px rgba(16, 185, 129, 0.1);
                z-index: 10001;
                display: flex;
                flex-direction: column;
                gap: 4px;
                min-width: 120px;
                animation: scale-up-settings 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            `;

            // Position next to the anchor element
            const rect = anchorElement.getBoundingClientRect();
            menu.style.top = (rect.top + window.scrollY) + 'px';
            menu.style.left = (rect.right + window.scrollX + 10) + 'px';

            const createBtn = (text, mode) => {
                const btn = document.createElement('button');
                btn.textContent = text;
                btn.style.cssText = `
                    background: transparent;
                    border: none;
                    color: #e2e8f0;
                    padding: 8px 12px;
                    text-align: left;
                    cursor: pointer;
                    border-radius: 4px;
                    font-size: 13px;
                    font-family: inherit;
                    transition: background 0.2s, color 0.2s;
                `;
                btn.onmouseenter = () => {
                    btn.style.background = 'rgba(16, 185, 129, 0.15)';
                    btn.style.color = '#10b981';
                };
                btn.onmouseleave = () => {
                    btn.style.background = 'transparent';
                    btn.style.color = '#e2e8f0';
                };
                btn.onclick = (e) => {
                    e.stopPropagation();
                    chrome.storage.local.set({ sidebarDisplayMode: mode });
                    menu.remove();
                };
                return btn;
            };

            menu.appendChild(createBtn('Credits', 'credits'));
            menu.appendChild(createBtn('Days Left', 'daysLeft'));
            menu.appendChild(createBtn('Enjoy!', 'enjoy'));

            document.body.appendChild(menu);

            // Close when clicking outside
            const closeMenu = (e) => {
                if (!menu.contains(e.target) && e.target !== anchorElement) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            };
            setTimeout(() => document.addEventListener('click', closeMenu), 10);
        },

        // Update sidebar balance display
        updateSidebarBalance: function () {
            const balanceValueDiv = document.getElementById('balance-value-sidebar');
            const balanceLabelDiv = document.getElementById('balance-label-sidebar');
            if (!balanceValueDiv) return;

            chrome.storage.local.get({
                latest: null,
                numericDisplayEnabled: false,
                monthlyPrice: 0,
                decimalPlaces: 0,
                planStartCredit: 10000,
                sidebarDisplayMode: 'credits',
                renewalDay: 1
            }, (res) => {
                if (chrome.runtime.lastError) {
                    console.error('[Credit Tracker for Genspark] Failed to update sidebar balance:', chrome.runtime.lastError);
                    balanceValueDiv.textContent = 'ERROR';
                    return;
                }

                const mode = res.sidebarDisplayMode || 'credits';

                if (mode === 'enjoy') {
                    if (balanceLabelDiv) balanceLabelDiv.style.display = 'none';
                    balanceValueDiv.textContent = 'Enjoy!';
                    balanceValueDiv.style.fontSize = '14px';
                    balanceValueDiv.style.marginTop = '4px';
                } else if (mode === 'credits') {
                    if (balanceLabelDiv) {
                        balanceLabelDiv.style.display = 'block';
                        balanceLabelDiv.textContent = '[Log] Credits';
                    }
                    balanceValueDiv.style.fontSize = '16px';
                    balanceValueDiv.style.marginTop = '0';
                    if (res.latest && res.latest.count !== undefined) {
                        const monthlyPrice = parseFloat(res.monthlyPrice) || 0;
                        const decimalPlaces = (res.decimalPlaces !== undefined && res.decimalPlaces !== null)
                            ? parseInt(res.decimalPlaces, 10)
                            : 0;
                        const baseStartCredit = parseInt(res.planStartCredit, 10) || 10000;
                        const conversionRate = baseStartCredit > 0 ? monthlyPrice / baseStartCredit : 0;
                        balanceValueDiv.textContent = UICommon.formatValue(res.latest.count, res.numericDisplayEnabled, conversionRate, decimalPlaces);
                    } else {
                        balanceValueDiv.textContent = '---';
                    }
                } else if (mode === 'daysLeft') {
                    if (balanceLabelDiv) {
                        balanceLabelDiv.style.display = 'block';
                        balanceLabelDiv.textContent = 'Renewal In';
                    }
                    balanceValueDiv.style.fontSize = '16px';
                    balanceValueDiv.style.marginTop = '0';
                    const daysLeft = window.GensparkTracker.Modules.MetricsCalculator.getDaysLeft(res.renewalDay);
                    balanceValueDiv.textContent = `${daysLeft} Days`;
                }
            });
        },

        tryAddSidebarWithRetry: function () {
            // Check if already added
            if (document.getElementById('balance-display-sidebar')) {
                Logger.debugLog('[Credit Tracker for Genspark] Sidebar balance already exists');
                State.sidebarInitialLoadComplete = true;
                Logger.debugLog('[Credit Tracker for Genspark] Observer enabled');
                return;
            }

            // Check for .sidebar-footer
            const sidebarFooter = document.querySelector('.sidebar-footer');

            if (sidebarFooter) {
                // Strategy 1 available
                Logger.debugLog('[Credit Tracker for Genspark] Initial call, adding sidebar balance (.sidebar-footer found)');
                this.addBalanceAboveSidebarFooter();

                // Enable observer
                setTimeout(() => {
                    State.sidebarInitialLoadComplete = true;
                    Logger.debugLog('[Credit Tracker for Genspark] Observer enabled');
                    this.initObserver();
                }, 500);

            } else if (State.sidebarRetryCount < Config.MAX_SIDEBAR_RETRIES) {
                // Retry if not found
                State.sidebarRetryCount++;
                Logger.debugLog(`[Credit Tracker for Genspark] .sidebar-footer not found, retry ${State.sidebarRetryCount}/${Config.MAX_SIDEBAR_RETRIES} in 1000ms`);

                setTimeout(() => this.tryAddSidebarWithRetry(), 1000);

            } else {
                // Fallback when max retries reached
                Logger.debugLog('[Credit Tracker for Genspark] Max retries reached, falling back to Strategy 3');
                this.addBalanceAboveSidebarFooter();

                // Enable observer
                setTimeout(() => {
                    State.sidebarInitialLoadComplete = true;
                    Logger.debugLog('[Credit Tracker for Genspark] Observer enabled');
                    this.initObserver();
                }, 500);
            }
        },

        initObserver: function () {
            // Already initialized check
            if (this.isObserverRunning) return;
            this.isObserverRunning = true;

            let sidebarObserverTimeout = null;

            const sidebarObserver = new MutationObserver(() => {
                // Cancel existing timeout (debounce)
                if (sidebarObserverTimeout) {
                    clearTimeout(sidebarObserverTimeout);
                }

                // Run after 100ms
                sidebarObserverTimeout = setTimeout(() => {
                    // Optimized check: Don't even log if it already exists
                    if (document.getElementById('balance-display-sidebar')) return;

                    Logger.debugLog('[Credit Tracker for Genspark] Sidebar missing, re-adding...');
                    this.addBalanceAboveSidebarFooter();
                }, 100);
            });

            sidebarObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
            Logger.debugLog('[Credit Tracker for Genspark] Sidebar MutationObserver started');
        }
    };

    window.GensparkTracker.UI.Sidebar = Sidebar;

})();
