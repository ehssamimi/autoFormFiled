/**
 * Radio Button Filler Module
 * Handles radio button groups
 */

export class RadioFieldFiller {
    /**
     * Select a radio button
     * @param {Object} page - Playwright page object
     * @param {string} nameSelector - Selector for radio button name
     * @param {string} value - Value to select
     * @param {string} fieldName - Field name for logging
     * @returns {Promise<boolean>} True if selected successfully
     */
    static async fill(page, nameSelector, value, fieldName = '') {
        try {
            // Try by value attribute
            const valueSelector = `${nameSelector}[value="${value}"]`;
            const element = page.locator(valueSelector).first();
            await element.waitFor({ state: 'visible', timeout: 2000 });
            
            if (await element.count() > 0) {
                await element.check();
                console.log(`✅ ${fieldName}: '${value}'`);
                return true;
            }
        } catch (error) {
            // Try by label text
            try {
                const label = page.locator(`label:has-text("${value}")`).first();
                const radioId = await label.getAttribute('for');
                if (radioId) {
                    const radio = page.locator(`#${radioId}`).first();
                    if (await radio.count() > 0) {
                        await radio.check();
                        console.log(`✅ ${fieldName}: '${value}' (by label)`);
                        return true;
                    }
                }
            } catch (error2) {
                // Try clicking label directly
                try {
                    const label = page.locator(`label:has-text("${value}")`).first();
                    if (await label.count() > 0) {
                        await label.click();
                        console.log(`✅ ${fieldName}: '${value}' (by label click)`);
                        return true;
                    }
                } catch (error3) {
                    // Try partial match
                    try {
                        const label = page.locator(`label`).filter({ hasText: value }).first();
                        if (await label.count() > 0) {
                            await label.click();
                            console.log(`✅ ${fieldName}: '${value}' (partial match)`);
                            return true;
                        }
                    } catch (error4) {
                        // Ignore
                    }
                }
            }
        }
        
        console.log(`⚠️  ${fieldName} option '${value}' not found`);
        return false;
    }
}

