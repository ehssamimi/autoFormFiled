/**
 * Autocomplete/Typeahead Filler Module
 * Handles autocomplete, typeahead, and custom select components
 */

export class AutocompleteFiller {
    /**
     * Fill an autocomplete/typeahead field
     * @param {Object} page - Playwright page object
     * @param {string[]} selectors - List of CSS selectors to try
     * @param {string} value - Value to select
     * @param {string} fieldName - Field name for logging
     * @returns {Promise<boolean>} True if filled successfully
     */
    static async fill(page, selectors, value, fieldName = '') {
        for (const selector of selectors) {
            try {
                const locator = page.locator(selector).first();
                await locator.waitFor({ state: 'visible', timeout: 500 });
                
                if (await locator.count() > 0) {
                    await locator.scrollIntoViewIfNeeded();
                    await page.waitForTimeout(50);
                    
                    // Strategy 1: Try typing and selecting from dropdown
                    try {
                        await locator.click();
                        await page.waitForTimeout(200);
                        await locator.fill(value);
                        await page.waitForTimeout(500); // Wait for dropdown to appear
                        
                        // Try to click on the first suggestion
                        const suggestion = page.locator(`[role="option"]:has-text("${value}"), .autocomplete-item:has-text("${value}"), .typeahead-item:has-text("${value}")`).first();
                        if (await suggestion.count() > 0) {
                            await suggestion.click();
                            await page.waitForTimeout(200);
                            console.log(`✅ ${fieldName || selector}: '${value}' (autocomplete)`);
                            return true;
                        }
                        
                        // If no suggestion found, try pressing Enter
                        await locator.press('Enter');
                        await page.waitForTimeout(200);
                        const currentValue = await locator.inputValue();
                        if (currentValue.includes(value)) {
                            console.log(`✅ ${fieldName || selector}: '${value}' (autocomplete - Enter)`);
                            return true;
                        }
                    } catch (error) {
                        // Continue to next strategy
                    }
                    
                    // Strategy 2: Try using Selectize API (if available)
                    try {
                        const success = await page.evaluate((sel, val) => {
                            const $el = $(sel);
                            if ($el.length > 0 && $el[0].selectize) {
                                $el[0].selectize.setValue(val, true);
                                return true;
                            }
                            return false;
                        }, selector, value);
                        
                        if (success) {
                            await page.waitForTimeout(200);
                            console.log(`✅ ${fieldName || selector}: '${value}' (selectize)`);
                            return true;
                        }
                    } catch (error) {
                        // Continue
                    }
                    
                    // Strategy 3: Direct fill (for simple autocomplete inputs)
                    try {
                        await locator.fill(value);
                        await page.waitForTimeout(200);
                        const currentValue = await locator.inputValue();
                        if (currentValue === value || currentValue.includes(value)) {
                            console.log(`✅ ${fieldName || selector}: '${value}' (direct)`);
                            return true;
                        }
                    } catch (error) {
                        // Continue
                    }
                }
            } catch (error) {
                continue;
            }
        }
        
        return false;
    }
}

