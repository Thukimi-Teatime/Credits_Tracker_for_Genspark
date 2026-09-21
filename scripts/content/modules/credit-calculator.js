// ========================================
// Credit Calculator Module
// ========================================

(function () {
    const Logger = window.GensparkTracker.Utils.Logger;
    const State = window.GensparkTracker.State;
    const Config = window.GensparkTracker.Config;

    // IDs of elements injected by this extension — must never be read as credit values
    const INJECTED_IDS = [
        'genspark-embedded-tracker',
        'genspark-tracker-dashboard',
        'balance-display-sidebar',
        'graph-trigger-sidebar'
    ];

    // Modifier class the service applies to a "usage / percentage" row
    // (e.g. "無料枠: 残り100%"). Rows with this class are NOT the actual
    // credit balance and must be skipped when locating the correct row.
    const USAGE_ROW_CLASS = 'credit-menu-row-usage';

    /**
     * Returns true if the given element is inside any of the extension's own injected elements.
     */
    const isInsideInjectedElement = (el) => {
        return INJECTED_IDS.some(id => {
            const injected = document.getElementById(id);
            return injected && injected.contains(el);
        });
    };

    const Calculator = {
        /**
         * Locate the ".credit-menu-row" that holds the RAW credit balance.
         *
         * As of the service update, the profile menu can render MULTIPLE
         * ".item.credit-left" containers side by side — e.g. one row for
         * "無料枠" (free-tier usage %) and one row for "クレジット" (the
         * actual credit balance). Blindly taking the first match on the
         * page reads the wrong (percentage) value, so this method walks
         * every candidate row and skips anything that is not the real
         * balance:
         *
         *   1. Skip rows explicitly marked as usage rows via the
         *      "credit-menu-row-usage" modifier class.
         *   2. Skip rows whose value text contains "%" (defensive check —
         *      still catches percentage rows even if the class name is
         *      renamed again in a future update).
         *   3. Skip rows/values that belong to our own injected UI, so we
         *      never read back our own Price-Converted display.
         *
         * @returns {HTMLElement|null} The correct ".credit-menu-row", or null.
         */
        findCreditMenuRow: function () {
            const rows = Array.from(document.querySelectorAll('.item.credit-left .credit-menu-row'));

            for (const row of rows) {
                // Rule 1: explicit usage/percentage modifier class
                if (row.classList.contains(USAGE_ROW_CLASS)) continue;

                const valueEl = row.querySelector('.credit-menu-value');
                if (!valueEl) continue;

                // Rule 3: skip our own injected UI
                if (isInsideInjectedElement(valueEl)) continue;

                const valueText = (valueEl.innerText || valueEl.textContent || '').trim();

                // Rule 2: defensive percentage check
                if (valueText.includes('%')) continue;

                return row;
            }

            return null;
        },

        /**
         * Robust function to get credit value
         * Tries multiple strategies and uses the first successful one
         */
        getCreditValue: function () {
            const self = this;

            const strategies = [
                // Strategy 1: Direct Strategy (Current UI)
                // Targets the correct '.credit-menu-row' (see findCreditMenuRow)
                // and its value-containing child.
                () => {
                    const row = self.findCreditMenuRow();
                    if (!row) return null;

                    // Try to get the credit-menu-value element first, fallback to older structure.
                    // IMPORTANT: Skip any element that belongs to the extension's own injected UI
                    // to avoid reading Price-Converted display values as raw credit counts.
                    let valueElement = row.querySelector('.credit-menu-value');
                    if (!valueElement || isInsideInjectedElement(valueElement)) {
                        // Fallback: walk children, skip the injected tracker div
                        const children = Array.from(row.children).filter(
                            child => !INJECTED_IDS.includes(child.id)
                        );
                        valueElement = children[1] || children[0] || null;
                    }
                    if (!valueElement) return null;

                    const text = valueElement.innerText || valueElement.textContent;
                    return self.parseAndValidateCreditValue(text);
                },

                // Strategy 2: Container Text Strategy (UI Update Resilience)
                // Extracts numbers from the correct container (the one that owns the
                // matching credit-menu-row) regardless of internal structure.
                // Clones the container and strips injected elements + percentage
                // figures before reading text, preventing usage-% values and
                // converted Price Display values from being detected as credits.
                () => {
                    const row = self.findCreditMenuRow();
                    if (!row) return null;

                    // Use the specific container that owns the correct row — there
                    // can be multiple ".item.credit-left" containers on the page.
                    const container = row.closest('.item.credit-left') || row;

                    // Clone and remove injected elements so their converted values don't interfere
                    const clone = container.cloneNode(true);
                    INJECTED_IDS.forEach(id => {
                        const injected = clone.querySelector('#' + id);
                        if (injected) injected.remove();
                    });

                    const allText = clone.innerText || clone.textContent;
                    if (!allText) return null;

                    // Strip "NN%" occurrences first so a stray usage-percentage
                    // figure inside the same container can never win as "largest number".
                    const withoutPercent = allText.replace(/\d+(\.\d+)?\s*%/g, '');

                    // Extract all numbers and pick the most likely credit candidate
                    const matches = withoutPercent.match(/\d+/g);
                    if (!matches || matches.length === 0) return null;

                    const numbers = matches.map(m => parseInt(m, 10)).filter(n => !isNaN(n));
                    if (numbers.length === 0) return null;
                    // Credits are usually the primary/largest number in this small container
                    return Math.max(...numbers);
                },

                // Strategy 3: Global Keyword Strategy (UI Redesign Resilience)
                // Searches for price/credit related keywords across the entire sidebar/header.
                // Explicitly excludes containers that are part of this extension's own UI.
                // DISABLED: Too broad — prone to false positives from converted Price Display values
                // and other UI elements containing credit-related keywords. Keep code for reference.
                () => {
                    return null; // Disabled

                    /* eslint-disable no-unreachable */
                    const keywords = ['credit', 'balance', 'remain'];
                    const selector = keywords.map(kw => `[class*="${kw}"], [id*="${kw}"]`).join(', ');
                    const possibleContainers = document.querySelectorAll(selector);

                    for (const container of possibleContainers) {
                        // Skip any element that is inside (or is) an injected tracker element
                        if (isInsideInjectedElement(container)) continue;
                        if (INJECTED_IDS.includes(container.id)) continue;

                        const text = container.innerText || container.textContent;
                        if (!text) continue;

                        const parsed = self.parseAndValidateCreditValue(text);
                        // Filter for "reasonable" values to avoid picking IDs or random UI numbers
                        if (parsed !== null && parsed >= 0 && parsed < 1000000) {
                            return parsed;
                        }
                    }
                    return null;
                }
            ];

            // Try stages in order
            for (let i = 0; i < strategies.length; i++) {
                const stageNum = i + 1;
                try {
                    Logger.debugLog(`[Credit Tracker for Genspark] Attempting Stage ${stageNum}...`);
                    const result = strategies[i]();

                    // Allow 0 as valid value
                    if (result !== null && result !== undefined && result >= 0) {
                        Logger.logSuccess(stageNum, result);
                        return { value: result, strategy: stageNum };
                    }
                } catch (error) {
                    // Try next stage even if error occurs
                    Logger.logError(stageNum, error);
                }
            }

            // All stages failed
            Logger.logFailure();
            return null;
        },

        /**
         * Extract number from text and validate
         */
        parseAndValidateCreditValue: function (text) {
            if (!text || typeof text !== 'string') return null;

            // Remove commas, spaces, other separators
            const cleaned = text.replace(/[,\s]/g, '');

            // Extract numbers only
            const numberMatch = cleaned.match(/\d+/);
            if (!numberMatch) return null;

            const value = parseInt(numberMatch[0], 10);

            // Validation
            if (isNaN(value)) return null;
            if (value < 0) return null;
            if (value > 10000000) return null;

            return value;
        },

        /**
         * Check valid stability and return confirmed value
         * Prioritize non-zero values
         * @returns {number|null} Confirmed value or null if unstable
         */
        checkValueStability: function () {
            const detectedValues = State.detectedValues;
            const detectionAttemptCount = State.detectionAttemptCount;

            if (detectedValues.length === 0) {
                return null;
            }

            const lastValue = detectedValues[detectedValues.length - 1];
            const lastSaved = State.lastSavedCount;

            // "0" or "same as last saved count" is considered invalid/unchanged (loading or cached)
            const isInvalidOrUnchanged = lastValue === 0 || (lastSaved !== null && lastValue === lastSaved);

            if (isInvalidOrUnchanged) {
                // If max attempts not reached yet, delay confirmation and continue sampling
                if (detectionAttemptCount < Config.MAX_DETECTION_ATTEMPTS) {
                    Logger.debugLog(`[Credit Tracker for Genspark] → Detected value (${lastValue}) is 0 or same as last saved (${lastSaved}). Continuing detection...`);
                    return null;
                } else {
                    // Max attempts reached, adopt the value anyway as it might really be 0 or unchanged
                    Logger.debugLog(`[Credit Tracker for Genspark] → Max attempts reached. Adopting value: ${lastValue}`);
                    return lastValue;
                }
            }

            // If it's a new, non-zero value, confirm immediately if it is stable (QUICK_CONFIRM_COUNT times consecutively)
            if (detectedValues.length >= Config.QUICK_CONFIRM_COUNT) {
                const lastN = detectedValues.slice(-Config.QUICK_CONFIRM_COUNT);
                const allSame = lastN.every(v => v === lastValue);

                if (allSame) {
                    Logger.debugLog(`[Credit Tracker for Genspark] → New stable value (${lastValue}) detected ${Config.QUICK_CONFIRM_COUNT} times consecutively`);
                    return lastValue;
                }
            }

            // Not stable yet
            Logger.debugLog(`[Credit Tracker for Genspark] → Value not stable yet (${detectedValues.length} values collected)`);
            return null;
        }
    };

    window.GensparkTracker.Modules.Calculator = Calculator;

})();
