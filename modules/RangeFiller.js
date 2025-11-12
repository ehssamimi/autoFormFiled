/**
 * Range Slider Filler Module
 * Handles range input sliders
 */

export class RangeFiller {
    /**
     * Fill a range slider field
     * @param {Object} page - Playwright page object
     * @param {string[]} selectors - List of CSS selectors to try
     * @param {string|number} value - Value to set (will be converted to number)
     * @param {string} fieldName - Field name for logging
     * @returns {Promise<boolean>} True if filled successfully
     */
    static async fill(page, selectors, value, fieldName = '') {
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        
        if (isNaN(numValue)) {
            console.log(`⚠️  ${fieldName || 'Range'}: Invalid value '${value}', must be a number`);
            return false;
        }
        
        for (const selector of selectors) {
            try {
                const locator = page.locator(selector).first();
                await locator.waitFor({ state: 'visible', timeout: 500 });
                
                if (await locator.count() > 0) {
                    await locator.scrollIntoViewIfNeeded();
                    await page.waitForTimeout(50);
                    
                    // Get min, max, and step values
                    const min = await locator.getAttribute('min').then(v => v ? parseFloat(v) : 0).catch(() => 0);
                    const max = await locator.getAttribute('max').then(v => v ? parseFloat(v) : 100).catch(() => 100);
                    const step = await locator.getAttribute('step').then(v => v ? parseFloat(v) : 1).catch(() => 1);
                    
                    // Clamp value to min/max
                    const clampedValue = Math.max(min, Math.min(max, numValue));
                    
                    // Set value using evaluate (more reliable than fill for range inputs)
                    await locator.evaluate((input, val) => {
                        input.value = val;
                        // Trigger input and change events
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                    }, clampedValue);
                    
                    // Verify
                    const currentValue = await locator.inputValue();
                    if (Math.abs(parseFloat(currentValue) - clampedValue) < step) {
                        console.log(`✅ ${fieldName || selector}: '${clampedValue}' (range: ${min}-${max})`);
                        return true;
                    }
                }
            } catch (error) {
                continue;
            }
        }
        
        return false;
    }
}

