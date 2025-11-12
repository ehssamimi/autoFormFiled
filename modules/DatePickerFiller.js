/**
 * Date Picker Filler Module
 * Handles date inputs and datepicker widgets
 */

export class DatePickerFiller {
    /**
     * Fill a datepicker field
     * @param {Object} page - Playwright page object
     * @param {string[]} selectors - List of CSS selectors to try
     * @param {string} dateValue - Date value (YYYY-MM-DD, DD.MM.YYYY, etc.)
     * @param {string} fieldName - Field name for logging
     * @returns {Promise<boolean>} True if filled successfully
     */
    static async fill(page, selectors, dateValue, fieldName = '') {
        const normalizedDate = this._normalizeDate(dateValue);
        const [year, month, day] = normalizedDate.split('-');
        console.log(`📅 Normalized date: ${normalizedDate} (Year: ${year}, Month: ${month}, Day: ${day})`);
        
        for (const selector of selectors) {
            try {
                const locator = page.locator(selector).first();
                
                // Fast check - don't wait long if element doesn't exist
                const isVisible = await locator.isVisible().catch(() => false);
                if (!isVisible) {
                    // Try quick wait (500ms max)
                    try {
                        await locator.waitFor({ state: 'visible', timeout: 500 });
                    } catch (error) {
                        continue; // Skip to next selector quickly
                    }
                }
                
                if (await locator.count() > 0) {
                    await locator.scrollIntoViewIfNeeded();
                    
                    const inputType = await locator.getAttribute('type');
                    
                    if (inputType === 'date') {
                        // HTML5 date input
                        await locator.evaluate((el, date) => {
                            el.value = date;
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                        }, normalizedDate);
                        
                        const currentValue = await locator.inputValue();
                        if (this._validateDate(currentValue, normalizedDate, year, month, day)) {
                            console.log(`✅ ${fieldName}: '${currentValue}'`);
                            return true;
                        }
                    } else {
                        // Custom datepicker - try with validation and retry
                        const filled = await this._fillWithValidationAndRetry(
                            page, locator, year, month, day, fieldName
                        );
                        if (filled) {
                            return true;
                        }
                    }
                }
            } catch (error) {
                continue;
            }
        }
        
        // Try smart detection if direct selectors failed
        console.log(`⚠️  Date field not found with provided selectors, trying smart detection...`);
        return await this._smartDatePickerDetection(page, dateValue, fieldName);
    }

    /**
     * Fill datepicker with validation and retry mechanism
     * @param {Object} page - Playwright page object
     * @param {Object} locator - Field locator
     * @param {string} year - Year
     * @param {string} month - Month (01-12)
     * @param {string} day - Day
     * @param {string} fieldName - Field name
     * @returns {Promise<boolean>} True if filled and validated successfully
     */
    static async _fillWithValidationAndRetry(page, locator, year, month, day, fieldName) {
        const monthNum = parseInt(month, 10);
        const dayNum = parseInt(day, 10);
        
        // Strategy 1: Calendar selection with 0-based month index
        let success = await this._tryCalendarSelection(page, locator, year, month, day, monthNum, dayNum, 0, fieldName);
        if (success) return true;
        
        // Strategy 2: Calendar selection with 1-based month index
        console.log(`🔄 Retrying with 1-based month index...`);
        success = await this._tryCalendarSelection(page, locator, year, month, day, monthNum, dayNum, 1, fieldName);
        if (success) return true;
        
        // Strategy 3: Direct fill with different formats
        console.log(`🔄 Retrying with direct fill...`);
        const formats = this._getDateFormats(year, month, day);
        for (const format of formats) {
            try {
                await locator.clear();
                await locator.fill(format);
                await page.waitForTimeout(200);
                await page.keyboard.press('Tab');
                await page.waitForTimeout(200);
                
                const currentValue = await locator.inputValue();
                if (this._validateDate(currentValue, `${year}-${month}-${day}`, year, month, day)) {
                    console.log(`✅ ${fieldName}: '${currentValue}' (direct fill)`);
                    return true;
                }
            } catch (error) {
                continue;
            }
        }
        
        console.log(`❌ ${fieldName}: Failed to fill correctly after all retry attempts`);
        return false;
    }

    /**
     * Try calendar selection with specific month index offset
     * @param {Object} page - Playwright page object
     * @param {Object} locator - Field locator
     * @param {string} year - Year
     * @param {string} month - Month (01-12)
     * @param {string} day - Day
     * @param {number} monthNum - Month number (1-12)
     * @param {number} dayNum - Day number
     * @param {number} monthIndexOffset - 0 for 0-based, 1 for 1-based
     * @param {string} fieldName - Field name
     * @returns {Promise<boolean>} True if successful
     */
    static async _tryCalendarSelection(page, locator, year, month, day, monthNum, dayNum, monthIndexOffset, fieldName) {
        try {
            await locator.click();
            await page.waitForTimeout(300);
            
            const dateSelected = await this._selectFromCalendar(page, year, month, day, monthIndexOffset);
            if (dateSelected) {
                await page.waitForTimeout(300);
                const currentValue = await locator.inputValue();
                
                if (this._validateDate(currentValue, `${year}-${month}-${day}`, year, month, day)) {
                    console.log(`✅ ${fieldName}: '${currentValue}' (calendar, ${monthIndexOffset === 0 ? '0-based' : '1-based'})`);
                    return true;
                } else {
                    console.log(`⚠️  Validation failed: expected date with ${year}-${month}-${day}, got '${currentValue}'`);
                }
            }
        } catch (error) {
            // Ignore and try next strategy
        }
        return false;
    }

    /**
     * Validate if the filled date matches expected date
     * @param {string} currentValue - Current value in the field
     * @param {string} expectedDate - Expected date in YYYY-MM-DD format
     * @param {string} year - Expected year
     * @param {string} month - Expected month (01-12)
     * @param {string} day - Expected day
     * @returns {boolean} True if valid
     */
    static _validateDate(currentValue, expectedDate, year, month, day) {
        if (!currentValue || currentValue.length === 0) {
            return false;
        }
        
        // Normalize current value
        const normalizedCurrent = this._normalizeDate(currentValue);
        if (normalizedCurrent === expectedDate) {
            return true;
        }
        
        // Check if year, month, and day match (flexible format)
        const [currentYear, currentMonth, currentDay] = normalizedCurrent.split('-');
        if (currentYear === year && currentMonth === month && currentDay === day) {
            return true;
        }
        
        // Check common date formats
        const dayNum = parseInt(day, 10);
        const monthNum = parseInt(month, 10);
        
        // DD.MM.YYYY format
        if (currentValue.includes(`${dayNum}.${monthNum}.${year}`) || 
            currentValue.includes(`${day}.${month}.${year}`)) {
            return true;
        }
        
        // DD/MM/YYYY format
        if (currentValue.includes(`${dayNum}/${monthNum}/${year}`) || 
            currentValue.includes(`${day}/${month}/${year}`)) {
            return true;
        }
        
        return false;
    }

    /**
     * Smart date picker detection by label/aria-label
     * @param {Object} page - Playwright page object
     * @param {string} dateValue - Date value
     * @param {string} fieldName - Field name
     * @returns {Promise<boolean>} True if filled successfully
     */
    static async _smartDatePickerDetection(page, dateValue, fieldName) {
        const normalizedDate = this._normalizeDate(dateValue);
        const [year, month, day] = normalizedDate.split('-');
        
        const searchTerms = ['geburtsdatum', 'birth date', 'date of birth', 'geburt', 'datum', 'date_of_birth'];
        
        for (const term of searchTerms) {
            try {
                // Try by label text (case insensitive)
                const label = page.locator(`label:has-text("${term}") i`).first();
                const labelCount = await label.count().catch(() => 0);
                if (labelCount > 0) {
                    const labelFor = await label.getAttribute('for').catch(() => null);
                    if (labelFor) {
                        const input = page.locator(`#${labelFor}`).first();
                        if (await input.isVisible().catch(() => false)) {
                            console.log(`✅ Found field by label "for" attribute: #${labelFor}`);
                            const filled = await this.fill(page, [`#${labelFor}`], dateValue, fieldName);
                            if (filled) return true;
                        }
                    }
                    
                    // Try to find input near the label (using xpath)
                    try {
                        const labelElement = await label.elementHandle();
                        if (labelElement) {
                            const inputElement = await labelElement.evaluateHandle((el) => {
                                const input = el.closest('div')?.querySelector('input');
                                return input;
                            });
                            if (inputElement && inputElement.asElement()) {
                                const inputId = await inputElement.asElement().getAttribute('id');
                                const inputName = await inputElement.asElement().getAttribute('name');
                                const selector = inputId ? `#${inputId}` : (inputName ? `input[name="${inputName}"]` : null);
                                if (selector) {
                                    console.log(`✅ Found field near label: ${selector}`);
                                    const filled = await this.fill(page, [selector], dateValue, fieldName);
                                    if (filled) return true;
                                }
                            }
                        }
                    } catch (error) {
                        // Ignore
                    }
                }
                
                // Try by aria-label
                const ariaInput = page.locator(`input[aria-label*="${term}" i]`).first();
                if (await ariaInput.isVisible().catch(() => false)) {
                    console.log(`✅ Found field by aria-label`);
                    const filled = await this.fill(page, [`input[aria-label*="${term}" i]`], dateValue, fieldName);
                    if (filled) return true;
                }
                
                // Try by name or id containing the term
                const nameInput = page.locator(`input[name*="${term}" i], input[id*="${term}" i]`).first();
                if (await nameInput.isVisible().catch(() => false)) {
                    const name = await nameInput.getAttribute('name').catch(() => null);
                    const id = await nameInput.getAttribute('id').catch(() => null);
                    const selector = name ? `input[name="${name}"]` : (id ? `input[id="${id}"]` : null);
                    if (selector) {
                        console.log(`✅ Found field by name/id: ${selector}`);
                        const filled = await this.fill(page, [selector], dateValue, fieldName);
                        if (filled) return true;
                    }
                }
            } catch (error) {
                continue;
            }
        }
        
        console.log(`❌ Birth Date field not found`);
        return false;
    }

    /**
     * Select date from calendar widget
     * @param {Object} page - Playwright page object
     * @param {string} year - Year
     * @param {string} month - Month (01-12)
     * @param {string} day - Day
     * @param {number} monthIndexOffset - 0 for 0-based (0=Jan), 1 for 1-based (1=Jan)
     * @returns {Promise<boolean>} True if selected
     */
    static async _selectFromCalendar(page, year, month, day, monthIndexOffset = 0) {
        try {
            const dayNum = parseInt(day, 10);
            const monthNum = parseInt(month, 10);
            const yearNum = parseInt(year, 10);
            
            const calendarSelectors = [
                '.calendar', '.datepicker', '.flatpickr-calendar',
                '.ui-datepicker', '[class*="calendar"]', '[class*="datepicker"]',
                '.react-datepicker', '.air-datepicker', '.air-datepicker-body',
                '[class*="react-datepicker"]', '[class*="air-datepicker"]'
            ];
            
            // Wait for calendar
            for (const calSelector of calendarSelectors) {
                try {
                    const calendar = page.locator(calSelector).first();
                    await calendar.waitFor({ state: 'visible', timeout: 1000 });
                    if (await calendar.count() > 0) {
                        console.log(`📅 Calendar found, selecting year: ${year}, month: ${month}, day: ${day}`);
                        
                        // Step 1: Select year (if dropdown exists)
                        try {
                            const yearSelectors = [
                                'select:has-text("' + year + '")',
                                'select option[value="' + year + '"]',
                                '[aria-label*="year" i] select',
                                'select[name*="year" i]',
                                '.ui-datepicker-year',
                                'select.ui-datepicker-year'
                            ];
                            
                            for (const yearSelector of yearSelectors) {
                                try {
                                    const yearElement = page.locator(yearSelector).first();
                                    if (await yearElement.isVisible().catch(() => false)) {
                                        // Try to select year
                                        try {
                                            await yearElement.selectOption({ value: year });
                                            console.log(`✅ Year selected: ${year}`);
                                            await page.waitForTimeout(200);
                                            break;
                                        } catch (error) {
                                            // Try by text
                                            try {
                                                await yearElement.selectOption({ label: year });
                                                console.log(`✅ Year selected by label: ${year}`);
                                                await page.waitForTimeout(200);
                                                break;
                                            } catch (error2) {
                                                continue;
                                            }
                                        }
                                    }
                                } catch (error) {
                                    continue;
                                }
                            }
                        } catch (error) {
                            // Year selection failed, continue
                        }
                        
                        // Step 2: Select month (if dropdown exists)
                        try {
                            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                                               'July', 'August', 'September', 'October', 'November', 'December'];
                            const monthNamesDE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
                                                  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
                            const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                                              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                            const monthShortDE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
                                                 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
                            
                            const monthName = monthNames[monthNum - 1];
                            const monthNameDE = monthNamesDE[monthNum - 1];
                            const monthShortName = monthShort[monthNum - 1];
                            const monthShortNameDE = monthShortDE[monthNum - 1];
                            
                            const monthSelectors = [
                                `select option[value="${monthNum}"]`,
                                `select option[value="${month}"]`,
                                `select option[value="0${monthNum}"]`,
                                `select:has-text("${monthName}")`,
                                `select:has-text("${monthNameDE}")`,
                                `select:has-text("${monthShortName}")`,
                                `select:has-text("${monthShortNameDE}")`,
                                '[aria-label*="month" i] select',
                                'select[name*="month" i]',
                                '.ui-datepicker-month',
                                'select.ui-datepicker-month'
                            ];
                            
                            for (const monthSelector of monthSelectors) {
                                try {
                                    const monthElement = page.locator(monthSelector).first();
                                    if (await monthElement.isVisible().catch(() => false)) {
                                        // Try multiple methods to select month
                                        let monthSelected = false;
                                        
                                        // Method 1: Try by index with offset (0-based or 1-based)
                                        try {
                                            const monthIndex = monthNum - 1 + monthIndexOffset;
                                            await monthElement.selectOption({ index: monthIndex });
                                            console.log(`✅ Month selected by index (${monthIndexOffset === 0 ? '0-based' : '1-based'}): ${monthIndex} = month ${monthNum}`);
                                            await page.waitForTimeout(300);
                                            monthSelected = true;
                                        } catch (error) {
                                            // Method 2: Try by value with zero-padding (01, 02, etc.)
                                            try {
                                                await monthElement.selectOption({ value: month });
                                                console.log(`✅ Month selected by value (padded): ${month}`);
                                                await page.waitForTimeout(300);
                                                monthSelected = true;
                                            } catch (error2) {
                                                // Method 3: Try by value without padding (1, 2, etc.)
                                                try {
                                                    await monthElement.selectOption({ value: monthNum.toString() });
                                                    console.log(`✅ Month selected by value: ${monthNum}`);
                                                    await page.waitForTimeout(300);
                                                    monthSelected = true;
                                                } catch (error3) {
                                                    // Method 4: Try by label (German short name first - most likely for German sites)
                                                    try {
                                                        await monthElement.selectOption({ label: monthShortNameDE });
                                                        console.log(`✅ Month selected by short (DE): ${monthShortNameDE}`);
                                                        await page.waitForTimeout(300);
                                                        monthSelected = true;
                                                    } catch (error4) {
                                                        // Method 5: Try by label (English short name)
                                                        try {
                                                            await monthElement.selectOption({ label: monthShortName });
                                                            console.log(`✅ Month selected by short (EN): ${monthShortName}`);
                                                            await page.waitForTimeout(300);
                                                            monthSelected = true;
                                                        } catch (error5) {
                                                            // Method 6: Try by label (German full name)
                                                            try {
                                                                await monthElement.selectOption({ label: monthNameDE });
                                                                console.log(`✅ Month selected by label (DE): ${monthNameDE}`);
                                                                await page.waitForTimeout(300);
                                                                monthSelected = true;
                                                            } catch (error6) {
                                                                // Method 7: Try by label (English full name)
                                                                try {
                                                                    await monthElement.selectOption({ label: monthName });
                                                                    console.log(`✅ Month selected by label (EN): ${monthName}`);
                                                                    await page.waitForTimeout(300);
                                                                    monthSelected = true;
                                                                } catch (error7) {
                                                                    continue;
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        
                                        if (monthSelected) {
                                            break;
                                        }
                                    }
                                } catch (error) {
                                    continue;
                                }
                            }
                        } catch (error) {
                            // Month selection failed, continue
                        }
                        
                        // Step 3: Select day
                        await page.waitForTimeout(300); // Wait for calendar to update after year/month change
                        const daySelectors = [
                            `button:has-text("${dayNum}")`,
                            `td:has-text("${dayNum}")`,
                            `a:has-text("${dayNum}")`,
                            `[data-day="${day}"]`,
                            `[data-day="${dayNum}"]`,
                            `.day:has-text("${dayNum}")`,
                            `td a:has-text("${dayNum}")`
                        ];
                        
                        for (const daySelector of daySelectors) {
                            try {
                                const dayElement = page.locator(daySelector).first();
                                if (await dayElement.isVisible().catch(() => false)) {
                                    await dayElement.click();
                                    console.log(`✅ Day selected: ${dayNum}`);
                                    await page.waitForTimeout(200);
                                    return true;
                                }
                            } catch (error) {
                                continue;
                            }
                        }
                    }
                } catch (error) {
                    continue;
                }
            }
        } catch (error) {
            console.log(`⚠️  Calendar selection error: ${error.message}`);
        }
        
        return false;
    }

    /**
     * Get date formats
     * @param {string} year - Year
     * @param {string} month - Month
     * @param {string} day - Day
     * @returns {string[]} Date formats
     */
    static _getDateFormats(year, month, day) {
        const dayNum = parseInt(day, 10);
        const monthNum = parseInt(month, 10);
        
        return [
            `${dayNum}.${monthNum}.${year}`,  // DD.MM.YYYY
            `${day}.${month}.${year}`,        // DD.MM.YYYY (with zeros)
            `${year}-${month}-${day}`,        // YYYY-MM-DD
        ];
    }

    /**
     * Normalize date to YYYY-MM-DD
     * @param {string} dateValue - Date value
     * @returns {string} Normalized date
     */
    static _normalizeDate(dateValue) {
        if (!dateValue) return '';
        
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
            return dateValue;
        }
        
        if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateValue)) {
            const [d, m, y] = dateValue.split('.');
            return `${y}-${m}-${d}`;
        }
        
        if (/^\d{4}$/.test(dateValue)) {
            return `${dateValue}-01-01`;
        }
        
        try {
            const date = new Date(dateValue);
            if (!isNaN(date.getTime())) {
                const y = date.getFullYear();
                const m = String(date.getMonth() + 1).padStart(2, '0');
                const d = String(date.getDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
            }
        } catch (error) {
            // Ignore
        }
        
        return dateValue;
    }
}

