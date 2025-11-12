/**
 * Text Field Filler Module
 * Handles text, email, tel, password, and number inputs
 */

export class TextFieldFiller {
    /**
     * Fill a text input field
     * @param {Object} page - Playwright page object
     * @param {string[]} selectors - List of CSS selectors to try
     * @param {string} value - Value to fill
     * @param {string} fieldName - Field name for logging
     * @returns {Promise<boolean>} True if filled successfully
     */
    static async fill(page, selectors, value, fieldName = '') {
        for (const selector of selectors) {
            try {
                const locator = page.locator(selector).first();
                await locator.waitFor({ state: 'visible', timeout: 2000 });
                
                if (await locator.count() > 0) {
                    await locator.scrollIntoViewIfNeeded();
                    await page.waitForTimeout(50);
                    
                    await locator.focus();
                    await page.waitForTimeout(50);
                    
                    await locator.clear();
                    await page.waitForTimeout(50);
                    
                    await locator.fill(value);
                    await page.waitForTimeout(50);
                    
                    // Verify
                    const currentValue = await locator.inputValue();
                    if (currentValue === value || currentValue.includes(value)) {
                        console.log(`✅ ${fieldName || selector}: '${value}'`);
                        return true;
                    } else {
                        // Try typing if fill didn't work
                        await locator.clear();
                        await locator.type(value, { delay: 30 });
                        const typedValue = await locator.inputValue();
                        if (typedValue === value || typedValue.includes(value)) {
                            console.log(`✅ ${fieldName || selector}: '${value}' (typed)`);
                            return true;
                        }
                    }
                }
            } catch (error) {
                continue;
            }
        }
        
        return false;
    }

    /**
     * Smart detection for text fields
     * @param {Object} page - Playwright page object
     * @param {string} fieldName - Field name
     * @param {string} value - Value to fill
     * @returns {Promise<boolean>} True if filled successfully
     */
    static async smartFill(page, fieldName, value) {
        const searchTerms = this._getSearchTerms(fieldName);
        
        // Try by aria-label (English & German)
        for (const term of searchTerms) {
            try {
                const input = page.locator(`input[aria-label*="${term}" i], textarea[aria-label*="${term}" i]`).first();
                if (await input.count() > 0) {
                    await input.scrollIntoViewIfNeeded();
                    await input.focus();
                    await input.clear();
                    await input.fill(value);
                    console.log(`✅ ${fieldName}: '${value}' (smart: aria-label)`);
                    return true;
                }
            } catch (error) {
                continue;
            }
        }
        
        // Try by aria-labelledby
        for (const term of searchTerms) {
            try {
                // Find element with aria-labelledby that references label containing term
                const label = page.locator(`label:has-text("${term}") i`).first();
                if (await label.count() > 0) {
                    const labelId = await label.getAttribute('id');
                    if (labelId) {
                        const input = page.locator(`[aria-labelledby="${labelId}"]`).first();
                        if (await input.count() > 0) {
                            await input.scrollIntoViewIfNeeded();
                            await input.focus();
                            await input.clear();
                            await input.fill(value);
                            console.log(`✅ ${fieldName}: '${value}' (smart: aria-labelledby)`);
                            return true;
                        }
                    }
                }
            } catch (error) {
                continue;
            }
        }
        
        // Try by data-field-type
        for (const term of searchTerms) {
            try {
                const input = page.locator(`[data-field-type*="${term}" i]`).first();
                if (await input.count() > 0) {
                    await input.scrollIntoViewIfNeeded();
                    await input.focus();
                    await input.clear();
                    await input.fill(value);
                    console.log(`✅ ${fieldName}: '${value}' (smart: data-field-type)`);
                    return true;
                }
            } catch (error) {
                continue;
            }
        }
        
        // Try by role
        for (const term of searchTerms) {
            try {
                if (term.includes('search') || term.includes('email') || term.includes('text')) {
                    const input = page.locator(`[role="textbox"][aria-label*="${term}" i], [role="searchbox"][aria-label*="${term}" i]`).first();
                    if (await input.count() > 0) {
                        await input.scrollIntoViewIfNeeded();
                        await input.focus();
                        await input.clear();
                        await input.fill(value);
                        console.log(`✅ ${fieldName}: '${value}' (smart: role)`);
                        return true;
                    }
                }
            } catch (error) {
                continue;
            }
        }
        
        // Try by label
        for (const term of searchTerms) {
            try {
                const label = page.locator(`label:has-text("${term}") i`).first();
                const labelFor = await label.getAttribute('for');
                if (labelFor) {
                    const input = page.locator(`#${labelFor}`).first();
                    if (await input.count() > 0) {
                        await input.scrollIntoViewIfNeeded();
                        await input.focus();
                        await input.clear();
                        await input.fill(value);
                        console.log(`✅ ${fieldName}: '${value}' (smart: label)`);
                        return true;
                    }
                }
            } catch (error) {
                continue;
            }
        }
        
        // Try by autocomplete
        const autocompleteMap = {
            'first name': 'given-name',
            'vorname': 'given-name',
            'last name': 'family-name',
            'nachname': 'family-name',
            'email': 'email',
            'e-mail': 'email',
            'phone': 'tel',
            'telefon': 'tel'
        };
        
        for (const [key, autocomplete] of Object.entries(autocompleteMap)) {
            if (fieldName.toLowerCase().includes(key)) {
                try {
                    const input = page.locator(`input[autocomplete="${autocomplete}"], input[autocomplete*="${autocomplete}"]`).first();
                    if (await input.count() > 0) {
                        await input.scrollIntoViewIfNeeded();
                        await input.focus();
                        await input.clear();
                        await input.fill(value);
                        console.log(`✅ ${fieldName}: '${value}' (smart: autocomplete)`);
                        return true;
                    }
                } catch (error) {
                    continue;
                }
            }
        }
        
        return false;
    }

    /**
     * Get search terms from field name
     * @param {string} fieldName - Field name
     * @returns {string[]} Search terms
     */
    static _getSearchTerms(fieldName) {
        const terms = [];
        const lowerName = fieldName.toLowerCase();
        
        if (lowerName.includes('first') || lowerName.includes('vorname')) {
            terms.push('first', 'vorname', 'given');
        }
        if (lowerName.includes('last') || lowerName.includes('nachname')) {
            terms.push('last', 'nachname', 'family', 'surname');
        }
        if (lowerName.includes('email') || lowerName.includes('e-mail')) {
            terms.push('email', 'e-mail', 'mail');
        }
        if (lowerName.includes('phone') || lowerName.includes('telefon')) {
            terms.push('phone', 'telefon', 'tel', 'mobile');
        }
        
        const words = fieldName.split(/[\s\-_()]+/).filter(w => w.length > 2);
        terms.push(...words.map(w => w.toLowerCase()));
        
        return [...new Set(terms)];
    }
}

