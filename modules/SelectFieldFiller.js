/**
 * Select Field Filler Module
 * Handles dropdown/select fields with intelligent value mapping
 */

export class SelectFieldFiller {
    /**
     * Get value mappings for common fields
     * Maps English/config values to German/actual option values and labels
     * @param {string} fieldName - Field name (e.g., 'gender', 'country')
     * @param {string} configValue - Value from config
     * @returns {Object} Object with possible values and labels to try
     */
    static _getValueMappings(fieldName, configValue) {
        const lowerFieldName = (fieldName || '').toLowerCase();
        const lowerValue = (configValue || '').toLowerCase().trim();
        
        // Gender mappings
        if (lowerFieldName.includes('gender') || lowerFieldName.includes('geschlecht')) {
            const genderMappings = {
                'male': { values: ['m', 'male'], labels: ['Männlich', 'Male', 'männlich'] },
                'männlich': { values: ['m', 'male'], labels: ['Männlich', 'Male', 'männlich'] },
                'female': { values: ['w', 'f', 'female'], labels: ['Weiblich', 'Female', 'weiblich'] },
                'weiblich': { values: ['w', 'f', 'female'], labels: ['Weiblich', 'Female', 'weiblich'] },
                'divers': { values: ['d', 'divers'], labels: ['Divers', 'divers'] },
                'diverse': { values: ['d', 'divers'], labels: ['Divers', 'divers'] },
                'ohne angabe': { values: ['u', 'ohne_angabe', 'keine_angabe'], labels: ['Ohne Angabe', 'ohne angabe', 'keine angabe'] },
                'keine_angabe': { values: ['u', 'ohne_angabe', 'keine_angabe'], labels: ['Ohne Angabe', 'ohne angabe', 'keine angabe'] },
                'ohne_angabe': { values: ['u', 'ohne_angabe', 'keine_angabe'], labels: ['Ohne Angabe', 'ohne angabe', 'keine angabe'] }
            };
            
            if (genderMappings[lowerValue]) {
                return genderMappings[lowerValue];
            }
        }
        
        // Country mappings
        if (lowerFieldName.includes('country') || lowerFieldName.includes('land')) {
            const countryMappings = {
                'germany': { values: ['de', 'germany', 'deutschland'], labels: ['Germany', 'Deutschland', 'germany', 'deutschland'] },
                'deutschland': { values: ['de', 'germany', 'deutschland'], labels: ['Germany', 'Deutschland', 'germany', 'deutschland'] },
                'austria': { values: ['at', 'austria', 'österreich'], labels: ['Austria', 'Österreich', 'austria', 'österreich'] },
                'switzerland': { values: ['ch', 'switzerland', 'schweiz'], labels: ['Switzerland', 'Schweiz', 'switzerland', 'schweiz'] },
                'iran': { values: ['ir', 'iran', 'islamic republic of iran'], labels: ['Iran', 'Iran (Islamic Republic of)', 'Iran, Islamic Republic of', 'iran'] },
                'persia': { values: ['ir', 'iran', 'islamic republic of iran'], labels: ['Iran', 'Iran (Islamic Republic of)', 'Iran, Islamic Republic of', 'iran'] }
            };
            
            if (countryMappings[lowerValue]) {
                return countryMappings[lowerValue];
            }
        }
        
        // Job experience mappings - support direct value matching (e.g., "5" -> option value="5")
        if (lowerFieldName.includes('job_experience') || lowerFieldName.includes('professional experience') || lowerFieldName.includes('berufserfahrung')) {
            // If value is already a number (like "5"), return it directly for exact match
            if (!isNaN(configValue) && configValue !== '') {
                const numValue = String(configValue);
                return { values: [numValue], labels: [] };
            }
            
            const experienceMappings = {
                'beginners': { values: ['0'], labels: ['Einsteiger', 'Beginners', 'beginners'] },
                'einsteiger': { values: ['0'], labels: ['Einsteiger', 'Beginners', 'beginners'] },
                '1 year': { values: ['1'], labels: ['bis 1 Jahr', 'up to 1 year'] },
                'bis 1 jahr': { values: ['1'], labels: ['bis 1 Jahr', 'up to 1 year'] },
                '2 years': { values: ['2'], labels: ['bis 2 Jahre', 'up to 2 years'] },
                'bis 2 jahre': { values: ['2'], labels: ['bis 2 Jahre', 'up to 2 years'] },
                '5 years': { values: ['5'], labels: ['bis 5 Jahre', 'up to 5 years'] },
                'bis 5 jahre': { values: ['5'], labels: ['bis 5 Jahre', 'up to 5 years'] },
                '10 years': { values: ['10'], labels: ['bis 10 Jahre', 'up to 10 years'] },
                'bis 10 jahre': { values: ['10'], labels: ['bis 10 Jahre', 'up to 10 years'] },
                '15 years': { values: ['15'], labels: ['bis 15 Jahre oder mehr', 'up to 15 years or more'] },
                'bis 15 jahre oder mehr': { values: ['15'], labels: ['bis 15 Jahre oder mehr', 'up to 15 years or more'] },
                '15+': { values: ['15'], labels: ['bis 15 Jahre oder mehr', 'up to 15 years or more'] }
            };
            
            if (experienceMappings[lowerValue]) {
                return experienceMappings[lowerValue];
            }
        }
        
        // Career level mappings - support direct value matching
        if (lowerFieldName.includes('career_levels') || lowerFieldName.includes('karrierestufe') || lowerFieldName.includes('career level')) {
            // If value is already a number or string, return it directly for exact match
            if (configValue && configValue !== '') {
                return { values: [String(configValue)], labels: [] };
            }
        }
        
        // Graduation (Highest degree) mappings
        if (lowerFieldName.includes('graduation') || lowerFieldName.includes('highest degree') || lowerFieldName.includes('höchster abschluss')) {
            const graduationMappings = {
                'hauptschulabschluss': { values: ['Hauptschulabschluss'], labels: ['Secondary school leaving certificate / lower secondary school', 'Hauptschulabschluss'] },
                'realschulabschluss': { values: ['Realschulabschluss'], labels: ['Secondary school leaving certificate / vocational baccalaureate', 'Realschulabschluss'] },
                'abitur': { values: ['Abitur / Matura'], labels: ['Abitur / Matura', 'Abitur', 'Matura'] },
                'matura': { values: ['Abitur / Matura'], labels: ['Abitur / Matura', 'Abitur', 'Matura'] },
                'hochschule / uni / fh /etc.': { values: ['Hochschule / Uni / FH /etc.'], labels: ['College / University / University of Applied Sciences / etc.', 'Hochschule / Uni / FH /etc.', 'University', 'College'] },
                'university': { values: ['Hochschule / Uni / FH /etc.'], labels: ['College / University / University of Applied Sciences / etc.', 'Hochschule / Uni / FH /etc.', 'University', 'College'] },
                'college': { values: ['Hochschule / Uni / FH /etc.'], labels: ['College / University / University of Applied Sciences / etc.', 'Hochschule / Uni / FH /etc.', 'University', 'College'] },
                'bachelor': { values: ['Hochschule / Uni / FH /etc.'], labels: ['College / University / University of Applied Sciences / etc.', 'Hochschule / Uni / FH /etc.', 'University', 'College'] },
                'master': { values: ['Hochschule / Uni / FH /etc.'], labels: ['College / University / University of Applied Sciences / etc.', 'Hochschule / Uni / FH /etc.', 'University', 'College'] }
            };
            
            if (graduationMappings[lowerValue]) {
                return graduationMappings[lowerValue];
            }
        }
        
        // Language knowledge mappings (German and English)
        if (lowerFieldName.includes('german_knowledge') || lowerFieldName.includes('deutsch') || lowerFieldName.includes('english_knowledge') || lowerFieldName.includes('englisch')) {
            const languageMappings = {
                'unknown': { values: ['unknown'], labels: ['Keine Kenntnis', 'No knowledge', 'unknown'] },
                'no knowledge': { values: ['unknown'], labels: ['Keine Kenntnis', 'No knowledge', 'unknown'] },
                'keine kenntnis': { values: ['unknown'], labels: ['Keine Kenntnis', 'No knowledge', 'unknown'] },
                'little_known': { values: ['little_known'], labels: ['Geringe Kenntnis', 'Little knowledge', 'little_known'] },
                'little knowledge': { values: ['little_known'], labels: ['Geringe Kenntnis', 'Little knowledge', 'little_known'] },
                'geringe kenntnis': { values: ['little_known'], labels: ['Geringe Kenntnis', 'Little knowledge', 'little_known'] },
                'basic': { values: ['little_known'], labels: ['Geringe Kenntnis', 'Little knowledge', 'little_known'] },
                'advanced': { values: ['advanced'], labels: ['Fortgeschritten', 'Advanced', 'advanced'] },
                'fortgeschritten': { values: ['advanced'], labels: ['Fortgeschritten', 'Advanced', 'advanced'] },
                'fluent': { values: ['fluent'], labels: ['Verhandlungssicher', 'Fluent', 'fluent'] },
                'verhandlungssicher': { values: ['fluent'], labels: ['Verhandlungssicher', 'Fluent', 'fluent'] },
                'native': { values: ['fluent'], labels: ['Verhandlungssicher', 'Fluent', 'fluent'] },
                'native speaker': { values: ['fluent'], labels: ['Verhandlungssicher', 'Fluent', 'fluent'] }
            };
            
            if (languageMappings[lowerValue]) {
                return languageMappings[lowerValue];
            }
        }
        
        // Return original value as fallback
        return { values: [configValue], labels: [configValue] };
    }
    
    /**
     * Get all available options from a select field
     * @param {Object} locator - Playwright locator
     * @returns {Promise<Array>} Array of {value, label} objects
     */
    static async _getAvailableOptions(locator) {
        try {
            const options = await locator.evaluate(select => {
                const opts = [];
                for (const option of select.options) {
                    if (option.value && option.value.trim() !== '') {
                        opts.push({
                            value: option.value,
                            label: option.text.trim()
                        });
                    }
                }
                return opts;
            });
            return options;
        } catch (error) {
            return [];
        }
    }
    
    /**
     * Fill a select/dropdown field
     * @param {Object} page - Playwright page object
     * @param {string[]} selectors - List of CSS selectors to try
     * @param {string} value - Value to select
     * @param {string} fieldName - Field name for logging
     * @returns {Promise<boolean>} True if filled successfully
     */
    static async fill(page, selectors, value, fieldName = '') {
        // Process all select fields (not just Geschlecht)
        console.log(`🔍 Processing select field: "${fieldName}" with value: "${value}"`);
        for (const selector of selectors) {
            try {
                console.log(`   Trying selector: ${selector}`);
                const locator = page.locator(selector).first();
                await locator.waitFor({ state: 'visible', timeout: 5000 });
                
                if (await locator.count() > 0) {
                    await locator.scrollIntoViewIfNeeded();
                    await page.waitForTimeout(100);
                    
                    // Get value mappings
                    const mappings = this._getValueMappings(fieldName, value);
                    console.log(`   Mapped values: ${mappings.values.join(', ')}`);
                    console.log(`   Mapped labels: ${mappings.labels.join(', ')}`);
                    
                    // SIMPLE: Try direct DOM manipulation with mapped values FIRST
                    for (const mappedValue of mappings.values) {
                        console.log(`   Trying DOM manipulation with value: "${mappedValue}"`);
                        try {
                            const success = await page.evaluate(({ sel, optionValue }) => {
                                const select = document.querySelector(sel);
                                if (select) {
                                    // Find option with this value
                                    for (let i = 0; i < select.options.length; i++) {
                                        if (select.options[i].value === optionValue || 
                                            select.options[i].value.toLowerCase() === optionValue.toLowerCase()) {
                                            select.value = select.options[i].value;
                                            
                                            // Trigger events
                                            const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                                            select.dispatchEvent(changeEvent);
                                            
                                            const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                                            select.dispatchEvent(inputEvent);
                                            
                                            return select.value === select.options[i].value;
                                        }
                                    }
                                }
                                return false;
                            }, { sel: selector, optionValue: mappedValue });
                            
                            if (success) {
                                await page.waitForTimeout(200);
                                console.log(`✅ ${fieldName || selector}: '${value}' -> '${mappedValue}' (direct DOM)`);
                                return true;
                            }
                        } catch (error) {
                            // Continue to next value
                        }
                    }
                    
                    // FALLBACK: Try selectOption with mapped values
                    for (const mappedValue of mappings.values) {
                        try {
                            await locator.selectOption({ value: mappedValue }, { timeout: 5000 });
                            const selectedValue = await locator.inputValue();
                            if (selectedValue === mappedValue || selectedValue.toLowerCase() === mappedValue.toLowerCase()) {
                                console.log(`✅ ${fieldName || selector}: '${value}' -> '${mappedValue}' (selectOption)`);
                                return true;
                            }
                        } catch (error) {
                            // Continue to next value
                        }
                    }
                    
                    // FALLBACK 2: Try by label
                    for (const mappedLabel of mappings.labels) {
                        try {
                            await locator.selectOption({ label: mappedLabel }, { timeout: 5000 });
                            const selectedValue = await locator.inputValue();
                            if (selectedValue) {
                                console.log(`✅ ${fieldName || selector}: '${value}' -> '${mappedLabel}' (by label)`);
                                return true;
                            }
                        } catch (error) {
                            // Continue
                        }
                    }
                    
                    // FALLBACK 3: Try original value directly (for cases like job_experience="5")
                    try {
                        // First try DOM manipulation with original value
                        const success = await page.evaluate(({ sel, optionValue }) => {
                            const select = document.querySelector(sel);
                            if (select) {
                                // Find option with this value (exact match first)
                                for (let i = 0; i < select.options.length; i++) {
                                    if (select.options[i].value === optionValue) {
                                        select.value = select.options[i].value;
                                        const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                                        select.dispatchEvent(changeEvent);
                                        return select.value === select.options[i].value;
                                    }
                                }
                                // Try case-insensitive match
                                for (let i = 0; i < select.options.length; i++) {
                                    if (select.options[i].value.toLowerCase() === optionValue.toLowerCase()) {
                                        select.value = select.options[i].value;
                                        const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                                        select.dispatchEvent(changeEvent);
                                        return select.value === select.options[i].value;
                                    }
                                }
                            }
                            return false;
                        }, { sel: selector, optionValue: value });
                        
                        if (success) {
                            await page.waitForTimeout(200);
                            console.log(`✅ ${fieldName || selector}: '${value}' (direct DOM)`);
                            return true;
                        }
                    } catch (error) {
                        // Continue
                    }
                    
                    // Try selectOption with original value
                    try {
                        await locator.selectOption({ value: value }, { timeout: 5000 });
                        const selectedValue = await locator.inputValue();
                        if (selectedValue === value || selectedValue.toLowerCase() === value.toLowerCase()) {
                            console.log(`✅ ${fieldName || selector}: '${value}' (direct)`);
                            return true;
                        }
                    } catch (error) {
                        // Try by label
                        try {
                            await locator.selectOption({ label: value }, { timeout: 5000 });
                            const selectedValue = await locator.inputValue();
                            if (selectedValue) {
                                console.log(`✅ ${fieldName || selector}: '${value}' (by label direct)`);
                                return true;
                            }
                        } catch (error2) {
                            // Continue
                        }
                    }
                }
            } catch (error) {
                continue;
            }
        }
        console.log(`❌ Failed to fill select field: "${fieldName}"`);
        return false;
    }
}

