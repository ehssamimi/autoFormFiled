/**
 * Checkbox Field Filler Module
 * Handles checkbox fields
 */

export class CheckboxFieldFiller {
    /**
     * Check/uncheck a checkbox
     * @param {Object} page - Playwright page object
     * @param {string[]} selectors - List of CSS selectors to try
     * @param {boolean} checked - Whether to check or uncheck
     * @param {string} fieldName - Field name for logging
     * @returns {Promise<boolean>} True if filled successfully
     */
    static async fill(page, selectors, checked, fieldName = '') {
        for (const selector of selectors) {
            try {
                const locator = page.locator(selector).first();
                await locator.waitFor({ state: 'visible', timeout: 2000 });
                
                if (await locator.count() > 0) {
                    await locator.scrollIntoViewIfNeeded();
                    
                    if (checked) {
                        await locator.check();
                    } else {
                        await locator.uncheck();
                    }
                    
                    console.log(`✅ ${fieldName || selector}: ${checked ? 'checked' : 'unchecked'}`);
                    return true;
                }
            } catch (error) {
                continue;
            }
        }
        
        return false;
    }
}

