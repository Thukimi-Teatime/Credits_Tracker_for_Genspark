// ========================================
// Credit Calculator Module
// ========================================

(function () {
    const Logger = window.GensparkTracker.Utils.Logger;
    const State = window.GensparkTracker.State;
    const Config = window.GensparkTracker.Config;

    const Calculator = {
        /**
         * Robust function to get credit value
         * Tries multiple strategies and uses the first successful one
         */
        getCreditValue: function () {
            const self = this;
            // IDs of elements injected by this extension — must never be read as credit values
            const INJECTED_IDS = [
                'genspark-embedded-tracker',
                'genspark-tracker-dashboard',
                'balance-display-sidebar',
                'graph-trigger-sidebar'
            ];

            /**
             * Returns true if the given element is inside any of the extension's own injected elements.
             */
            const isInsideInjectedElement = (el) => {
                return INJECTED_IDS.some(id => {
                    const injected = document.getElementById(id);
                    return injected && injected.contains(el);
                });
            };

            const strategies = [
                // Strategy 1: Direct Strategy (Current UI)
                // Targets specifically '.item.credit-left' and its value-containing child.
                () => {
                    const container = document.querySelector('.item.credit-left');
                    if (!container) return null;

                    // Try to get the credit-menu-value element first, fallback to older structure.
                    // IMPORTANT: Skip any element that belongs to the extension's own injected UI
                    // to avoid reading Price-Converted display values as raw credit counts.
                    let valueElement = container.querySelector('.credit-menu-value');
                    if (!valueElement || isInsideInjectedElement(valueElement)) {
                        // Fallback: walk children, skip the injected tracker div
                        const children = Array.from(container.children).filter(
                            child => !INJECTED_IDS.includes(child.id)
                        );
                        valueElement = children[1] || children[0] || null;
                    }
                    if (!valueElement) return null;

                    const text = valueElement.innerText || valueElement.textContent;
                    return self.parseAndValidateCreditValue(text);
                },

                // Strategy 2: Container Text Strategy (UI Update Resilience)
                // Extracts numbers from the known container regardless of internal structure.
                // Clones the container and strips injected elements before reading text,
                // preventing converted Price Display values from being detected as credits.
                () => {
                    const container = document.querySelector('.item.credit-left');
                    if (!container) return null;

                    // Clone and remove injected elements so their converted values don't interfere
                    const clone = container.cloneNode(true);
                    INJECTED_IDS.forEach(id => {
                        const injected = clone.querySelector('#' + id);
                        if (injected) injected.remove();
                    });

                    const allText = clone.innerText || clone.textContent;
                    if (!allText) return null;

                    // Extract all numbers and pick the most likely credit candidate
                    const matches = allText.match(/\d+/g);
                    if (!matches || matches.length === 0) return null;

                    const numbers = matches.map(m => parseInt(m, 10)).filter(n => !isNaN(n));
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
