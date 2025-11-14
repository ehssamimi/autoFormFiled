/**
 * Automated Web Form Filler
 * This tool automatically fills web forms with predefined data.
 * Supports text fields, dropdowns, checkboxes, file uploads, and more.
 * Modular architecture with separate fillers for each field type.
 */

import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';

import { FieldFiller } from './modules/FieldFiller.js';
import { RadioFieldFiller } from './modules/RadioFieldFiller.js';
import { FileUploadFiller } from './modules/FileUploadFiller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class FormFiller {
    /**
     * Initialize FormFiller with configuration file.
     * @param {string} configPath - Path to JSON configuration file
     */
    constructor(configPath = 'config.json') {
        this.configPath = configPath;
        this.config = this._loadConfig();
        this.browser = null;
        this.page = null;
    }

    /**
     * Load configuration from JSON file.
     * @returns {Object} Configuration object
     */
    _loadConfig() {
        try {
            const configFile = readFileSync(this.configPath, 'utf-8');
            return JSON.parse(configFile);
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.error(`❌ Config file not found: ${this.configPath}`);
            } else {
                console.error(`❌ Invalid JSON in config file: ${this.configPath}`);
            }
            throw error;
        }
    }

    /**
     * Main method to fill a form on the given URL.
     * @param {string} url - The URL of the web page containing the form
     * @param {boolean} autoSubmit - If true, automatically submits the form after filling
     */
    async fillForm(url, autoSubmit = false) {
        // Launch browser based on settings
        const headless = this.config.settings?.headless || false;
        this.browser = await chromium.launch({ headless });
        this.page = await this.browser.newPage();

        try {
            console.log(`🌐 Navigating to: ${url}`);
            
            // Navigate to the form page
            await this.page.goto(url, { 
                waitUntil: 'domcontentloaded', // Changed from 'networkidle' to be faster
                timeout: 90000 // Increased timeout to 90 seconds
            });

            // Wait for page to fully load
            const waitTimeout = this.config.settings?.wait_timeout || 5000; // Increased default wait time
            await this.page.waitForTimeout(waitTimeout);

            // Handle cookie consent popup - try multiple times with delays
            // Cookie popups often appear with delay after page load
            let cookieHandled = false;
            let cookieDoesNotExist = false; // Flag to track if cookie doesn't exist
            
            for (let attempt = 1; attempt <= 5; attempt++) {
                // Wait 2 seconds BEFORE checking (to give cookie popup time to appear)
                if (attempt > 1) {
                    console.log(`⏳ Waiting 2 seconds before checking cookie consent (attempt ${attempt}/5)...`);
                    await this.page.waitForTimeout(2000);
                }
                
                console.log(`🍪 Checking for cookie consent (attempt ${attempt}/5)...`);
                const result = await this._handleCookieConsent();
                
                if (result === null) {
                    // Cookie doesn't exist - no need to check again
                    console.log('ℹ️  Cookie consent popup does not exist on this page');
                    cookieDoesNotExist = true;
                    break;
                } else if (result === true) {
                    // Cookie was found and handled
                    cookieHandled = true;
                    console.log('⏳ Waiting for cookie popup to fully close...');
                    await this.page.waitForTimeout(2000);
                    break;
                }
                // If result === false, continue to next attempt (cookie might appear later)
                
                // Always wait 2 seconds AFTER checking (even if not found)
                await this.page.waitForTimeout(2000);
            }

            // If URL has anchor, scroll to it and wait for form to load
            if (url.includes('#')) {
                const anchor = url.split('#')[1];
                console.log(`📍 Scrolling to anchor: #${anchor}`);
                try {
                    await this.page.evaluate((anchorId) => {
                        // Try multiple ways to find the anchor
                        let element = document.getElementById(anchorId);
                        if (!element) {
                            element = document.querySelector(`[name="${anchorId}"]`);
                        }
                        if (!element) {
                            element = document.querySelector(`a[name="${anchorId}"]`);
                        }
                        if (!element) {
                            // Try to find form with this id or name
                            element = document.querySelector(`form#${anchorId}`);
                        }
                        if (!element) {
                            element = document.querySelector(`form[name="${anchorId}"]`);
                        }
                        if (!element) {
                            // Try to find any element with this id/name
                            element = document.querySelector(`[id*="${anchorId}"], [name*="${anchorId}"]`);
                        }
                        if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            return true;
                        }
                        return false;
                    }, anchor);
                    await this.page.waitForTimeout(2000); // Wait for scroll and form to load
                } catch (error) {
                    console.log(`⚠️  Could not scroll to anchor: ${error.message}`);
                }
            }

            // Close popup/modal if exists (for empfehlungsbund.de)
            // await this._closePopup();

            // Wait a bit more for form to be visible after popup closes
            await this.page.waitForTimeout(3000);
            
            // Try to wait for form to be visible
            let formDetected = false;
            try {
                await this.page.waitForSelector('form, input[name*="name"], input[name*="email"]', { 
                    timeout: 10000 
                });
                console.log('✅ Form detected');
                formDetected = true;
            } catch (error) {
                console.log('⚠️  Form might not be fully loaded');
            }
            
            // If form not detected, check for cookie consent again (it might have appeared)
            if (!formDetected && !cookieDoesNotExist) {
                console.log('🔄 Form not found, checking for cookie consent again...');
                for (let attempt = 1; attempt <= 5; attempt++) {
                    // Wait 2 seconds BEFORE checking
                    if (attempt > 1) {
                        console.log(`⏳ Waiting 2 seconds before re-checking cookie consent (attempt ${attempt}/5)...`);
                        await this.page.waitForTimeout(2000);
                    }
                    
                    console.log(`🍪 Re-checking cookie consent (attempt ${attempt}/5)...`);
                    const result = await this._handleCookieConsent();
                    
                    if (result === null) {
                        // Cookie doesn't exist - no need to check again
                        console.log('ℹ️  Cookie consent popup does not exist on this page');
                        cookieDoesNotExist = true;
                        break;
                    } else if (result === true) {
                        // Cookie was found and handled
                        cookieHandled = true;
                        // Wait more after handling
                        console.log('⏳ Waiting for cookie popup to fully close and form to load...');
                        await this.page.waitForTimeout(3000);
                        // Try to detect form again
                        try {
                            await this.page.waitForSelector('form, input[name*="name"], input[name*="email"], input[name*="vorname"], input[name*="nachname"]', { 
                                timeout: 5000 
                            });
                            console.log('✅ Form detected after cookie consent handled');
                            formDetected = true;
                            break;
                        } catch (error) {
                            // Continue to next attempt
                            console.log(`⚠️  Form still not found after attempt ${attempt}`);
                        }
                    }
                    // If result === false, continue to next attempt
                    
                    // Always wait 2 seconds AFTER checking
                    await this.page.waitForTimeout(2000);
                }
            }

            // Wait a bit more after cookie consent to ensure form is fully loaded
            if (cookieHandled) {
                console.log('⏳ Waiting for form to load after cookie consent...');
                await this.page.waitForTimeout(3000);
                
                // Re-check for cookie consent (might reappear or appear late)
                console.log('🍪 Final cookie consent check...');
                await this._handleCookieConsent();
                await this.page.waitForTimeout(2000);
            }
            
            // Check for iframes that might contain the form
            const iframes = await this.page.locator('iframe').all();
            if (iframes.length > 0) {
                console.log(`🔍 Found ${iframes.length} iframe(s), checking for forms inside...`);
                for (let i = 0; i < iframes.length; i++) {
                    try {
                        const frame = await iframes[i].contentFrame();
                        if (frame) {
                            const iframeFormFields = await frame.evaluate(() => {
                                return Array.from(document.querySelectorAll('input, select, textarea')).length;
                            });
                            console.log(`   Iframe ${i + 1}: ${iframeFormFields} form fields found`);
                        }
                    } catch (error) {
                        // Iframe might not be accessible
                    }
                }
            }
            
            // Fill all form fields
            await this._fillAllFields();
            
            // TEMPORARILY COMMENTED: Only focus on file uploads (for debugging)
            // await this._fillFileUploadsOnly();

            // Take screenshot before submission (for verification)
            await this.page.screenshot({ 
                path: 'form_filled.png', 
                fullPage: true 
            });
            console.log('📸 Screenshot saved: form_filled.png');

            // Submit form if requested
            if (autoSubmit) {
                await this._submitForm();
            } else {
                console.log('⏸️  Form filled but not submitted (autoSubmit=false)');
                console.log('   Review the form in the browser and submit manually if needed');
            }

        } catch (error) {
            if (error.name === 'TimeoutError') {
                console.error('❌ Timeout: Page took too long to load');
            } else {
                console.error(`❌ Error occurred: ${error.message}`);
            }
            await this._handleError();
        } finally {
            // Keep browser open for manual review if not headless
            if (headless || autoSubmit) {
                // Keep browser open for review
                // await this.browser.close();
                console.log('\n🌐 Browser will remain open for review. Close manually when done.');
            } else {
                console.log('🔍 Browser kept open for manual review. Close it when done.');
            }
        }
    }

    /**
     * Fill all form fields based on configuration.
     * Fills fields in order from top to bottom, only if value exists in config.
     */
    async _fillAllFields() {
        const personalInfo = this.config.personal_info || {};
        const filePaths = this.config.file_paths || {};
        const questions = this.config.questions || {};
        const talentPool = this.config.talent_pool || null;
        
        // Get all form fields sorted by position (top to bottom)
        const fields = await this._getFormFieldsInOrder();
        
        console.log(`\n📋 Found ${fields.length} form fields. Processing in order...\n`);
        
        // First, log all fields with their raw info for debugging
        console.log('🔍 All discovered fields (before processing):');
        for (let i = 0; i < fields.length; i++) {
            try {
                const fieldInfo = await this._getFieldInfo(fields[i]);
                const fieldLabel = fieldInfo.label || fieldInfo.name || fieldInfo.id || `Field #${i + 1}`;
                const debugInfo = [];
                if (fieldInfo.name) debugInfo.push(`name="${fieldInfo.name}"`);
                if (fieldInfo.id) debugInfo.push(`id="${fieldInfo.id}"`);
                if (fieldInfo.label) debugInfo.push(`label="${fieldInfo.label}"`);
                const debugStr = debugInfo.length > 0 ? ` [${debugInfo.join(', ')}]` : '';
                console.log(`  ${i + 1}. "${fieldLabel}" (${fieldInfo.type || 'unknown'})${debugStr}`);
            } catch (error) {
                console.log(`  ${i + 1}. Field #${i + 1} (error getting info)`);
            }
        }
        console.log('');
        
        // Track which fields we've already processed
        const processedFieldNames = new Set();
        
        // Now process fields
        for (const field of fields) {
            const fieldInfo = await this._getFieldInfo(field);
            const configValue = this._getConfigValueForField(fieldInfo, personalInfo, filePaths, questions, talentPool);
            
            // Handle checkbox for talent pool (app_register) - but don't skip, let it be processed normally too
            if (fieldInfo.type === 'checkbox' && (fieldInfo.name === 'app_register' || fieldInfo.id === 'app_register_btn')) {
                if (questions.talent_pool_enabled === true) {
                    console.log(`✅ Field: "${fieldInfo.label || fieldInfo.name}" (checkbox) - Checking talent pool checkbox`);
                    try {
                        const checkbox = this.page.locator(`input[name="${fieldInfo.name}"], input#${fieldInfo.id}`).first();
                        if (await checkbox.count() > 0) {
                            const isChecked = await checkbox.isChecked().catch(() => false);
                            if (!isChecked) {
                                await checkbox.check();
                                console.log(`✅ Talent pool checkbox checked`);
                                await this.page.waitForTimeout(2000); // Wait for dynamic fields to appear
                                
                                // Now scan and fill talent pool fields
                                await this._fillTalentPoolFields(talentPool, processedFieldNames);
                            }
                        }
                    } catch (error) {
                        console.log(`⚠️  Error checking talent pool checkbox: ${error.message}`);
                    }
                }
                // Don't continue - let it be processed normally too (will be checked by _checkAllCheckboxes)
            }
            
            // Log field info with more details
            const fieldLabel = fieldInfo.label || fieldInfo.name || fieldInfo.id || 'Unknown';
            const fieldType = fieldInfo.type || 'unknown';
            const debugInfo = [];
            if (fieldInfo.name) debugInfo.push(`name="${fieldInfo.name}"`);
            if (fieldInfo.id) debugInfo.push(`id="${fieldInfo.id}"`);
            if (fieldInfo.label) debugInfo.push(`label="${fieldInfo.label}"`);
            const debugStr = debugInfo.length > 0 ? ` [${debugInfo.join(', ')}]` : '';
            
            if (configValue !== null && configValue !== undefined && configValue !== '') {
                console.log(`✅ Field: "${fieldLabel}" (${fieldType})${debugStr} - Value in config: "${configValue}"`);
                await this._fillFieldByInfo(field, fieldInfo, configValue);
                
                // Track processed field
                if (fieldInfo.name) processedFieldNames.add(fieldInfo.name);
                if (fieldInfo.id) processedFieldNames.add(fieldInfo.id);
                
                // After uploading CV (file_app_map), check for newly visible fields like photo
                if (fieldInfo.name === 'file_app_map' || fieldInfo.name === 'file_cover_letter') {
                    console.log(`\n🔍 Checking for newly visible fields after ${fieldInfo.name} upload...`);
                    await this.page.waitForTimeout(2000); // Wait for any dynamic content to appear
                    
                    // Re-scan for file_photo field
                    if (filePaths.photo && !processedFieldNames.has('file_photo')) {
                        try {
                            const photoInput = this.page.locator('input[name="file_photo"]').first();
                            const photoCount = await photoInput.count().catch(() => 0);
                            if (photoCount > 0) {
                                const isVisible = await photoInput.isVisible().catch(() => false);
                                if (isVisible) {
                                    const photoFieldInfo = await this._getFieldInfo(photoInput);
                                    const photoConfigValue = this._getConfigValueForField(photoFieldInfo, personalInfo, filePaths, questions, talentPool);
                                    if (photoConfigValue) {
                                        console.log(`✅ Found newly visible photo field: "${photoFieldInfo.label || photoFieldInfo.name}" - Value in config: "${photoConfigValue}"`);
                                        await this._fillFieldByInfo(photoInput, photoFieldInfo, photoConfigValue);
                                        processedFieldNames.add('file_photo');
                                    }
                                }
                            }
                        } catch (error) {
                            // Ignore if photo field doesn't exist
                        }
                    }
                }
            } else {
                console.log(`⏭️  Field: "${fieldLabel}" (${fieldType})${debugStr} - No value in config, skipping`);
            }
        }
        
        // Final check: Look for file upload fields that might have been missed (like photo fields)
        // Check for file_photo specifically
        if (filePaths.photo && !processedFieldNames.has('file_photo')) {
            try {
                const photoInput = this.page.locator('input[name="file_photo"]').first();
                if (await photoInput.count() > 0) {
                    const isVisible = await photoInput.isVisible().catch(() => false);
                    if (isVisible) {
                        const photoFieldInfo = await this._getFieldInfo(photoInput);
                        const photoConfigValue = this._getConfigValueForField(photoFieldInfo, personalInfo, filePaths, questions, talentPool);
                        if (photoConfigValue) {
                            console.log(`✅ Found photo field: "${photoFieldInfo.label || photoFieldInfo.name}" - Value in config: "${photoConfigValue}"`);
                            await this._fillFieldByInfo(photoInput, photoFieldInfo, photoConfigValue);
                        }
                    }
                }
            } catch (error) {
                // Ignore if photo field doesn't exist
            }
        }
        
        // Check all visible checkboxes automatically
        await this._checkAllCheckboxes(processedFieldNames);
        
        console.log('\n✅ All fields processed');
    }

    /**
     * Check all visible checkboxes in the form
     * @param {Set} processedFieldNames - Set of already processed field names
     */
    async _checkAllCheckboxes(processedFieldNames) {
        console.log('\n☑️  Checking all visible checkboxes...');
        
        try {
            // Find all visible checkboxes (including custom ones with role="checkbox" or role="switch")
            const allCheckboxes = await this.page.evaluate(() => {
                // Get native checkboxes
                const nativeCheckboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
                
                // Get custom checkboxes with role
                const customCheckboxes = Array.from(document.querySelectorAll('[role="checkbox"], [role="switch"]'));
                
                // Combine and deduplicate
                const allCb = [...nativeCheckboxes, ...customCheckboxes];
                const uniqueCb = Array.from(new Set(allCb));
                
                return uniqueCb
                    .filter(cb => {
                        // Check if visible
                        const style = window.getComputedStyle(cb);
                        return (
                            style.display !== 'none' &&
                            style.visibility !== 'hidden' &&
                            style.opacity !== '0' &&
                            cb.offsetWidth > 0 &&
                            cb.offsetHeight > 0 &&
                            !cb.disabled &&
                            !cb.readOnly
                        );
                    })
                    .map(cb => {
                        // For custom checkboxes, check aria-checked
                        const isChecked = cb.type === 'checkbox' 
                            ? cb.checked 
                            : (cb.getAttribute('aria-checked') === 'true');
                        
                        return {
                            name: cb.name || '',
                            id: cb.id || '',
                            checked: isChecked,
                            ariaLabel: cb.getAttribute('aria-label') || '',
                            role: cb.getAttribute('role') || '',
                            isCustom: cb.type !== 'checkbox',
                            label: (() => {
                                // Try to find label
                                if (cb.id) {
                                    const label = document.querySelector(`label[for="${cb.id}"]`);
                                    if (label) return label.textContent?.trim() || '';
                                }
                                const parentLabel = cb.closest('label');
                                if (parentLabel) return parentLabel.textContent?.trim() || '';
                                
                                // Try aria-labelledby
                                const ariaLabelledBy = cb.getAttribute('aria-labelledby');
                                if (ariaLabelledBy) {
                                    const labelEl = document.getElementById(ariaLabelledBy);
                                    if (labelEl) return labelEl.textContent?.trim() || '';
                                }
                                
                                // Try to find nearby text that might contain * (for required fields)
                                // Look for parent section or fieldset that might have a title with *
                                let parent = cb.parentElement;
                                let depth = 0;
                                while (parent && depth < 5) {
                                    // Check if parent or any sibling contains text with *
                                    const parentText = parent.textContent || '';
                                    if (parentText.includes('*')) {
                                        // Try to find a heading or label in this section
                                        const heading = parent.querySelector('h1, h2, h3, h4, h5, h6, .title, .label, label, [class*="title"], [class*="label"]');
                                        if (heading) {
                                            return heading.textContent?.trim() || parentText.substring(0, 100).trim();
                                        }
                                    }
                                    parent = parent.parentElement;
                                    depth++;
                                }
                                
                                return '';
                            })()
                        };
                    });
            });
            
            console.log(`🔍 Found ${allCheckboxes.length} visible checkbox(es)`);
            
            let checkedCount = 0;
            for (const checkbox of allCheckboxes) {
                try {
                    const labelText = checkbox.label || checkbox.ariaLabel || checkbox.name || checkbox.id || 'Checkbox';
                    
                    // Check if label contains * (asterisk) - these are required fields and should be checked
                    const isRequired = labelText.includes('*') || checkbox.ariaLabel?.includes('*');
                    
                    // Skip if already processed (unless it's a required field with *)
                    if (!isRequired) {
                        if (checkbox.name && processedFieldNames.has(checkbox.name)) {
                            console.log(`⏭️  Skipping already processed checkbox: "${labelText}" (name="${checkbox.name}")`);
                            continue;
                        }
                        if (checkbox.id && processedFieldNames.has(checkbox.id)) {
                            console.log(`⏭️  Skipping already processed checkbox: "${labelText}" (id="${checkbox.id}")`);
                            continue;
                        }
                    }
                    
                    // Skip if already checked (unless it's required and we need to force check it)
                    if (checkbox.checked && !isRequired) {
                        console.log(`⏭️  Skipping already checked checkbox: "${labelText}"`);
                        continue;
                    }
                    
                    if (isRequired) {
                        console.log(`🔍 Required checkbox (contains *): "${labelText}" - will check it`);
                    } else {
                        console.log(`🔍 Attempting to check: "${labelText}" (name="${checkbox.name}", id="${checkbox.id}")`);
                    }
                    
                    // Find and check the checkbox
                    let locator = null;
                    if (checkbox.id) {
                        if (checkbox.isCustom) {
                            locator = this.page.locator(`#${checkbox.id}[role="checkbox"], #${checkbox.id}[role="switch"]`).first();
                        } else {
                            locator = this.page.locator(`input[type="checkbox"]#${checkbox.id}`).first();
                        }
                    } else if (checkbox.name) {
                        if (checkbox.isCustom) {
                            locator = this.page.locator(`[name="${checkbox.name}"][role="checkbox"], [name="${checkbox.name}"][role="switch"]`).first();
                        } else {
                            locator = this.page.locator(`input[type="checkbox"][name="${checkbox.name}"]`).first();
                        }
                    } else if (checkbox.ariaLabel) {
                        if (checkbox.isCustom) {
                            locator = this.page.locator(`[aria-label="${checkbox.ariaLabel}"][role="checkbox"], [aria-label="${checkbox.ariaLabel}"][role="switch"]`).first();
                        } else {
                            locator = this.page.locator(`input[type="checkbox"][aria-label="${checkbox.ariaLabel}"]`).first();
                        }
                    }
                    
                    if (locator && (await locator.count()) > 0) {
                        const isVisible = await locator.isVisible().catch(() => false);
                        if (isVisible) {
                            let isChecked = false;
                            if (checkbox.isCustom) {
                                // For custom checkboxes, check aria-checked
                                isChecked = await locator.getAttribute('aria-checked').then(v => v === 'true').catch(() => false);
                            } else {
                                isChecked = await locator.isChecked().catch(() => false);
                            }
                            
                            if (!isChecked || isRequired) {
                                // Scroll into view first
                                await locator.scrollIntoViewIfNeeded();
                                await this.page.waitForTimeout(200);
                                
                                let checkSuccess = false;
                                
                                if (checkbox.isCustom) {
                                    // For custom checkboxes, click and set aria-checked
                                    try {
                                        await locator.click();
                                        await locator.evaluate(el => {
                                            el.setAttribute('aria-checked', 'true');
                                            // Trigger change event
                                            const event = new Event('change', { bubbles: true });
                                            el.dispatchEvent(event);
                                        });
                                        checkSuccess = true;
                                    } catch (e) {
                                        console.log(`⚠️  Custom checkbox click failed, trying alternative method...`);
                                    }
                                } else {
                                    // Try multiple methods for native checkboxes
                                    try {
                                        // Method 1: Use check() with force
                                        await locator.check({ force: true });
                                        // Verify it worked
                                        const verified = await locator.isChecked().catch(() => false);
                                        if (verified) {
                                            checkSuccess = true;
                                        } else {
                                            throw new Error('check() did not change state');
                                        }
                                    } catch (e) {
                                        console.log(`⚠️  check() failed, trying click() method...`);
                                        try {
                                            // Method 2: Use click()
                                            await locator.click({ force: true });
                                            await this.page.waitForTimeout(100);
                                            // Verify it worked
                                            const verified = await locator.isChecked().catch(() => false);
                                            if (verified) {
                                                checkSuccess = true;
                                            } else {
                                                throw new Error('click() did not change state');
                                            }
                                        } catch (e2) {
                                            console.log(`⚠️  click() failed, trying direct DOM manipulation...`);
                                            try {
                                                // Method 3: Direct DOM manipulation
                                                await locator.evaluate(el => {
                                                    el.checked = true;
                                                    // Trigger all relevant events
                                                    const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                                                    el.dispatchEvent(changeEvent);
                                                    const clickEvent = new Event('click', { bubbles: true, cancelable: true });
                                                    el.dispatchEvent(clickEvent);
                                                    const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                                                    el.dispatchEvent(inputEvent);
                                                });
                                                await this.page.waitForTimeout(100);
                                                // Verify it worked
                                                const verified = await locator.isChecked().catch(() => false);
                                                if (verified) {
                                                    checkSuccess = true;
                                                }
                                            } catch (e3) {
                                                console.log(`⚠️  Direct DOM manipulation also failed`);
                                            }
                                        }
                                    }
                                }
                                
                                if (checkSuccess || isRequired) {
                                    // Double-check the state
                                    let finalChecked = false;
                                    if (checkbox.isCustom) {
                                        finalChecked = await locator.getAttribute('aria-checked').then(v => v === 'true').catch(() => false);
                                    } else {
                                        finalChecked = await locator.isChecked().catch(() => false);
                                    }
                                    
                                    if (finalChecked || isRequired) {
                                        console.log(`☑️  Checked: "${labelText}"`);
                                        checkedCount++;
                                        
                                        // Track as processed
                                        if (checkbox.name) processedFieldNames.add(checkbox.name);
                                        if (checkbox.id) processedFieldNames.add(checkbox.id);
                                        
                                        // Wait a bit for any dynamic content to appear
                                        await this.page.waitForTimeout(500);
                                    } else {
                                        console.log(`⚠️  Checkbox state verification failed: "${labelText}"`);
                                    }
                                }
                            } else {
                                console.log(`ℹ️  Checkbox already checked: "${labelText}"`);
                            }
                        } else {
                            console.log(`⚠️  Checkbox not visible: "${labelText}"`);
                        }
                    } else {
                        console.log(`⚠️  Checkbox not found with locator: "${labelText}"`);
                        // Try alternative selectors
                        if (checkbox.name) {
                            const altLocator = this.page.locator(`input[name="${checkbox.name}"]`).first();
                            if (await altLocator.count() > 0) {
                                const isVisible = await altLocator.isVisible().catch(() => false);
                                if (isVisible) {
                                    const isChecked = await altLocator.isChecked().catch(() => false);
                                    if (!isChecked || isRequired) {
                                        await altLocator.scrollIntoViewIfNeeded();
                                        await this.page.waitForTimeout(200);
                                        
                                        // Try multiple methods
                                        try {
                                            await altLocator.check({ force: true });
                                            const verified = await altLocator.isChecked().catch(() => false);
                                            if (verified) {
                                                console.log(`☑️  Checked (alternative selector): "${labelText}"`);
                                                checkedCount++;
                                                if (checkbox.name) processedFieldNames.add(checkbox.name);
                                                await this.page.waitForTimeout(500);
                                            } else {
                                                // Try click
                                                await altLocator.click({ force: true });
                                                await this.page.waitForTimeout(100);
                                                const verified2 = await altLocator.isChecked().catch(() => false);
                                                if (verified2) {
                                                    console.log(`☑️  Checked (alternative selector, click method): "${labelText}"`);
                                                    checkedCount++;
                                                    if (checkbox.name) processedFieldNames.add(checkbox.name);
                                                    await this.page.waitForTimeout(500);
                                                } else {
                                                    // Try DOM manipulation
                                                    await altLocator.evaluate(el => {
                                                        el.checked = true;
                                                        const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                                                        el.dispatchEvent(changeEvent);
                                                        const clickEvent = new Event('click', { bubbles: true, cancelable: true });
                                                        el.dispatchEvent(clickEvent);
                                                    });
                                                    await this.page.waitForTimeout(100);
                                                    const verified3 = await altLocator.isChecked().catch(() => false);
                                                    if (verified3) {
                                                        console.log(`☑️  Checked (alternative selector, DOM method): "${labelText}"`);
                                                        checkedCount++;
                                                        if (checkbox.name) processedFieldNames.add(checkbox.name);
                                                        await this.page.waitForTimeout(500);
                                                    }
                                                }
                                            }
                                        } catch (e) {
                                            console.log(`⚠️  Alternative selector methods failed: ${e.message}`);
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.log(`⚠️  Error checking checkbox "${checkbox.label || checkbox.name || checkbox.id}": ${error.message}`);
                    // Continue with next checkbox
                    continue;
                }
            }
            
            if (checkedCount > 0) {
                console.log(`✅ Checked ${checkedCount} checkbox(es)`);
            } else {
                console.log(`ℹ️  No unchecked checkboxes found`);
            }
        } catch (error) {
            console.log(`⚠️  Error checking checkboxes: ${error.message}`);
        }
    }

    /**
     * Fill only file upload fields (CV, Cover Letter, Photo)
     * For debugging file upload issues
     */
    async _fillFileUploadsOnly() {
        console.log('\n📁 FOCUS: File Uploads Only\n');
        
        const filePaths = this.config.file_paths || {};
        
        // CV / Resume
        if (filePaths.resume) {
            console.log('📄 Uploading CV/Resume...');
            const resumeSelectors = [
                'input[name="file_app_map"]',
                'input[name="file-upload"]',
                'input[type="file"][name*="resume"]',
                'input[type="file"][name*="cv"]',
                'input[type="file"][name*="lebenslauf"]'
            ];
            const uploaded = await FileUploadFiller.fill(this.page, resumeSelectors, filePaths.resume, 'CV/Resume');
            if (uploaded) {
                console.log('✅ CV/Resume uploaded successfully');
                await this.page.waitForTimeout(3000); // Wait for any dynamic content
            } else {
                console.log('❌ CV/Resume upload failed');
            }
        }
        
        // Cover Letter
        if (filePaths.cover_letter) {
            console.log('\n📄 Uploading Cover Letter...');
            const coverLetterSelectors = [
                'input[name="file_cover_letter"]',
                'input[type="file"][name*="cover"]',
                'input[type="file"][name*="motivation"]',
                'input[type="file"][name*="anschreiben"]'
            ];
            const uploaded = await FileUploadFiller.fill(this.page, coverLetterSelectors, filePaths.cover_letter, 'Cover Letter');
            if (uploaded) {
                console.log('✅ Cover Letter uploaded successfully');
                await this.page.waitForTimeout(3000); // Wait for any dynamic content
            } else {
                console.log('❌ Cover Letter upload failed');
            }
        }
        
        // Photo (might appear after CV upload)
        if (filePaths.photo) {
            console.log('\n📷 Uploading Photo...');
            await this.page.waitForTimeout(2000); // Wait a bit more
            const photoSelectors = [
                'input[name="file_photo"]',
                'input[type="file"][name*="photo"]',
                'input[type="file"][name*="foto"]',
                'input[type="file"][name*="bild"]',
                'input[type="file"][name*="profile"]'
            ];
            const uploaded = await FileUploadFiller.fill(this.page, photoSelectors, filePaths.photo, 'Photo');
            if (uploaded) {
                console.log('✅ Photo uploaded successfully');
            } else {
                console.log('⚠️  Photo upload failed (might not be visible yet)');
            }
        }
        
        console.log('\n✅ File uploads completed');
    }

    /**
     * Fill talent pool fields after checkbox is checked
     * @param {Object} talentPool - Talent pool config
     * @param {Set} processedFieldNames - Set of already processed field names
     */
    async _fillTalentPoolFields(talentPool, processedFieldNames) {
        if (!talentPool) {
            return;
        }
        
        console.log('\n🎯 Filling talent pool fields...');
        
        // Wait for talent_pool_fields container to be visible
        try {
            await this.page.waitForSelector('#talent_pool_fields', { state: 'visible', timeout: 3000 });
        } catch (error) {
            console.log('⚠️  Talent pool fields container not found');
            return;
        }
        
        // Re-scan for fields inside talent_pool_fields
        const talentPoolFields = await this.page.locator('#talent_pool_fields input, #talent_pool_fields select, #talent_pool_fields textarea').all();
        
        for (const field of talentPoolFields) {
            try {
                const fieldInfo = await this._getFieldInfo(field);
                const fieldName = fieldInfo.name || fieldInfo.id;
                
                if (!fieldName || processedFieldNames.has(fieldName)) {
                    continue;
                }
                
                // Get config value
                const personalInfo = this.config.personal_info || {};
                const filePaths = this.config.file_paths || {};
                const questions = this.config.questions || {};
                const configValue = this._getConfigValueForField(fieldInfo, personalInfo, filePaths, questions, talentPool);
                
                // Check if configValue is empty array or empty string - skip if so
                if (configValue !== null && configValue !== undefined && 
                    !(Array.isArray(configValue) && configValue.length === 0) &&
                    !(typeof configValue === 'string' && configValue.trim() === '')) {
                    console.log(`✅ Talent Pool Field: "${fieldInfo.label || fieldName}" - Value: "${configValue}"`);
                    
                    // Handle special cases
                    if (fieldName === 'job_categories' && Array.isArray(configValue)) {
                        // Multiple select with selectize - use selectize API
                        try {
                            await this.page.evaluate((values) => {
                                // Try to get selectize instance
                                const $select = $('#job_categories');
                                if ($select.length > 0) {
                                    const selectize = $select[0].selectize;
                                    if (selectize) {
                                        selectize.setValue(values);
                                        return true;
                                    }
                                }
                                // Fallback: select options directly in hidden select
                                const select = document.getElementById('job_categories');
                                if (select) {
                                    for (const value of values) {
                                        const option = select.querySelector(`option[value="${value}"]`);
                                        if (option) {
                                            option.selected = true;
                                        }
                                    }
                                    // Trigger change on selectize input if exists
                                    const selectizeInput = document.getElementById('job_categories-selectized');
                                    if (selectizeInput) {
                                        const event = new Event('change', { bubbles: true });
                                        select.dispatchEvent(event);
                                    }
                                }
                                return false;
                            }, configValue);
                            await this.page.waitForTimeout(500);
                            console.log(`✅ Selected job categories: ${configValue.join(', ')}`);
                        } catch (error) {
                            console.log(`⚠️  Error selecting job categories: ${error.message}`);
                        }
                    } else if (fieldName === 'career_levels' && Array.isArray(configValue) && configValue.length > 0) {
                        // Multiple select with selectize - use selectize API
                        try {
                            // First, click on the selectize input to open dropdown
                            const selectizeInput = this.page.locator('#career_levels-selectized').first();
                            if (await selectizeInput.count() > 0) {
                                await selectizeInput.scrollIntoViewIfNeeded();
                                await this.page.waitForTimeout(200);
                                await selectizeInput.click();
                                await this.page.waitForTimeout(500); // Wait for dropdown to open
                            }
                            
                            await this.page.evaluate((values) => {
                                // Try to get selectize instance first (preferred method)
                                const $select = $('#career_levels');
                                if ($select.length > 0 && $select[0].selectize) {
                                    const selectize = $select[0].selectize;
                                    // Set values using selectize API
                                    selectize.setValue(values);
                                    // Trigger change event
                                    selectize.trigger('change');
                                    return true;
                                }
                                
                                // Fallback 1: Click on options in dropdown
                                const dropdown = document.querySelector('.selectize-dropdown');
                                if (dropdown) {
                                    for (const value of values) {
                                        const option = dropdown.querySelector(`.option[data-value="${value}"]`);
                                        if (option) {
                                            option.click();
                                        }
                                    }
                                    return true;
                                }
                                
                                // Fallback 2: Select options directly in hidden select
                                const select = document.getElementById('career_levels');
                                if (select) {
                                    // Clear previous selections
                                    for (let i = 0; i < select.options.length; i++) {
                                        select.options[i].selected = false;
                                    }
                                    // Select new values
                                    for (const value of values) {
                                        const option = select.querySelector(`option[value="${value}"]`);
                                        if (option) {
                                            option.selected = true;
                                        }
                                    }
                                    // Trigger change event on select
                                    const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                                    select.dispatchEvent(changeEvent);
                                    
                                    // Also trigger on selectize input
                                    const selectizeInput = document.getElementById('career_levels-selectized');
                                    if (selectizeInput) {
                                        const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                                        selectizeInput.dispatchEvent(inputEvent);
                                    }
                                    return true;
                                }
                                return false;
                            }, configValue);
                            await this.page.waitForTimeout(500);
                            console.log(`✅ Selected career levels: ${configValue.join(', ')}`);
                        } catch (error) {
                            console.log(`⚠️  Error selecting career levels: ${error.message}`);
                        }
                    } else if (fieldName === 'radius') {
                        // Handle radius dropdown
                        try {
                            const radiusValue = String(configValue);
                            // Click the dropdown button
                            const success = await this.page.locator('#geo_radius_selector').first().evaluate((ul, val) => {
                                const items = ul.querySelectorAll('a[data-value]');
                                for (const item of items) {
                                    if (item.getAttribute('data-value') === val) {
                                        item.click();
                                        return true;
                                    }
                                }
                                return false;
                            }, radiusValue);
                            
                            if (success) {
                                console.log(`✅ Selected radius: ${radiusValue} km`);
                                await this.page.waitForTimeout(500);
                            } else {
                                console.log(`⚠️  Radius value "${radiusValue}" not found in dropdown`);
                            }
                        } catch (error) {
                            console.log(`⚠️  Error selecting radius: ${error.message}`);
                        }
                    } else {
                        // Normal field filling
                        await this._fillFieldByInfo(field, fieldInfo, configValue);
                    }
                    
                    processedFieldNames.add(fieldName);
                }
            } catch (error) {
                // Continue with next field
            }
        }
        
        // Handle skills separately (dynamic input)
        if (talentPool.skills && Array.isArray(talentPool.skills) && talentPool.skills.length > 0) {
            console.log(`\n📝 Adding skills: ${talentPool.skills.join(', ')}`);
            try {
                const skillInput = this.page.locator('input[name="newSkill"]').first();
                if (await skillInput.count() > 0) {
                    for (const skill of talentPool.skills) {
                        try {
                            await skillInput.fill(skill);
                            await this.page.waitForTimeout(500);
                            // Click add button
                            const addButton = this.page.locator('#addNewSkillSubmit').first();
                            if (await addButton.count() > 0) {
                                await addButton.click();
                                await this.page.waitForTimeout(1000); // Wait for skill to be added
                                console.log(`✅ Added skill: ${skill}`);
                            }
                        } catch (error) {
                            console.log(`⚠️  Error adding skill "${skill}": ${error.message}`);
                        }
                    }
                }
            } catch (error) {
                console.log(`⚠️  Error with skills input: ${error.message}`);
            }
        }
        
        console.log('\n✅ Talent pool fields processed');
    }

    /**
     * Get all form fields sorted by position (top to bottom)
     * Also checks inside iframes
     * @returns {Promise<Array>} Array of field elements
     */
    async _getFormFieldsInOrder() {
        // Wait a bit to ensure all dynamic content is loaded
        await this.page.waitForTimeout(1000);
        
        // First, check for iframes and get fields from them
        const iframeFields = [];
        try {
            const iframes = await this.page.locator('iframe').all();
            console.log(`🔍 Found ${iframes.length} iframe(s), checking for forms inside...`);
            
            for (const iframe of iframes) {
                try {
                    // Wait for iframe to load
                    await iframe.waitFor({ state: 'attached', timeout: 5000 }).catch(() => {});
                    const frame = await iframe.contentFrame();
                    if (frame) {
                        // Wait a bit for iframe content to load - try to wait for form or input elements
                        try {
                            await frame.waitForSelector('form, input, select, textarea', { timeout: 3000 }).catch(() => {});
                        } catch (e) {
                            // If selector wait fails, just wait a bit
                        }
                        await this.page.waitForTimeout(1000);
                        
                        const fieldsInFrame = await frame.evaluate(() => {
                            const fields = [];
                            const inputs = document.querySelectorAll('input, select, textarea');
                            
                            inputs.forEach(field => {
                                if (field.type === 'hidden' || field.type === 'submit' || field.type === 'button') {
                                    return;
                                }
                                
                                const isInForm = field.closest('form') !== null;
                                const hasNameOrId = field.name || field.id;
                                
                                if (isInForm && hasNameOrId) {
                                    // Get label
                                    let labelText = '';
                                    if (field.id) {
                                        const label = document.querySelector(`label[for="${field.id}"]`);
                                        if (label) labelText = label.textContent?.trim() || '';
                                    }
                                    if (!labelText) {
                                        const parentLabel = field.closest('label');
                                        if (parentLabel) labelText = parentLabel.textContent?.trim() || '';
                                    }
                                    
                                    const rect = field.getBoundingClientRect();
                                    fields.push({
                                        tagName: field.tagName.toLowerCase(),
                                        type: field.type || '',
                                        name: field.name || '',
                                        id: field.id || '',
                                        labelText: labelText,
                                        placeholder: field.getAttribute('placeholder') || '',
                                        y: rect.top,
                                        x: rect.left,
                                        isInIframe: true
                                    });
                                }
                            });
                            
                            return fields;
                        });
                        
                        // Convert iframe fields to locators
                        for (const field of fieldsInFrame) {
                            let locator = null;
                            if (field.id) {
                                locator = frame.locator(`#${field.id}`).first();
                            } else if (field.name) {
                                locator = frame.locator(`[name="${field.name}"]`).first();
                            }
                            
                            if (locator && await locator.count() > 0) {
                                iframeFields.push({ locator, fieldInfo: field, frame });
                            }
                        }
                    }
                } catch (error) {
                    console.log(`⚠️  Error accessing iframe: ${error.message}`);
                }
            }
        } catch (error) {
            console.log(`⚠️  Error checking iframes: ${error.message}`);
        }
        
        const allFields = await this.page.evaluate(() => {
            const fields = [];
            const processedNames = new Set(); // Track radio button groups
            
            // Get all input, select, textarea elements
            // Also check inside forms and common form containers
            const selectors = [
                'input',
                'select', 
                'textarea',
                'form input',
                'form select',
                'form textarea',
                '[class*="form"] input',
                '[class*="form"] select',
                '[class*="form"] textarea',
                '[id*="form"] input',
                '[id*="form"] select',
                '[id*="form"] textarea'
            ];
            
            const allInputs = new Set();
            selectors.forEach(selector => {
                try {
                    document.querySelectorAll(selector).forEach(el => allInputs.add(el));
                } catch (e) {}
            });
            
            const inputs = Array.from(allInputs);
            
            // Log all found inputs for debugging
            console.log(`[DEBUG] Found ${inputs.length} total input/select/textarea elements`);
            if (inputs.length > 0) {
                const sampleInputs = inputs.slice(0, 20).map(inp => {
                    const inForm = inp.closest('form') !== null;
                    const style = window.getComputedStyle(inp);
                    return {
                        tag: inp.tagName,
                        type: inp.type || 'N/A',
                        name: inp.name || 'N/A',
                        id: inp.id || 'N/A',
                        placeholder: inp.placeholder || 'N/A',
                        inForm: inForm,
                        display: style.display,
                        visibility: style.visibility,
                        width: inp.offsetWidth,
                        height: inp.offsetHeight
                    };
                });
                console.log(`[DEBUG] Sample inputs (first 20):`, JSON.stringify(sampleInputs, null, 2));
            }
            
            inputs.forEach((field, index) => {
                // Skip hidden fields and submit buttons
                if (field.type === 'hidden' || field.type === 'submit' || field.type === 'button') {
                    return;
                }
                
                // Check if field is visible to user
                // IMPORTANT: If field is in a form, include it even if it seems invisible
                // (forms are usually visible even if individual fields have 0 dimensions initially)
                const isInForm = field.closest('form') !== null;
                const hasNameOrId = field.name || field.id;
                
                // If field is in a form and has name/id, include it (very lenient for form fields)
                if (isInForm && hasNameOrId) {
                    // Include it - forms are usually visible
                } else {
                    // For fields outside forms, do stricter visibility check
                    const style = window.getComputedStyle(field);
                    const rect = field.getBoundingClientRect();
                    
                    const isVisible = (
                        style.display !== 'none' &&
                        style.visibility !== 'hidden' &&
                        style.opacity !== '0' &&
                        (field.offsetWidth > 0 && field.offsetHeight > 0 || 
                         (rect.width > 0 && rect.height > 0))
                    );
                    
                    if (!isVisible) {
                        return; // Skip invisible fields outside forms
                    }
                }
                
                // For radio buttons, only include the first one of each group
                if (field.type === 'radio') {
                    if (field.name && processedNames.has(field.name)) {
                        return; // Skip duplicate radio buttons in same group
                    }
                    if (field.name) {
                        processedNames.add(field.name);
                    }
                }
                
                // Get bounding rect
                const rect = field.getBoundingClientRect();
                const scrollY = window.scrollY || window.pageYOffset;
                const scrollX = window.scrollX || window.pageXOffset;
                
                // Get label text if available (priority order)
                let labelText = '';
                
                // Priority 1: aria-label
                const ariaLabel = field.getAttribute('aria-label');
                if (ariaLabel) {
                    labelText = ariaLabel.trim();
                }
                
                // Priority 2: aria-labelledby
                if (!labelText) {
                    const ariaLabelledBy = field.getAttribute('aria-labelledby');
                    if (ariaLabelledBy) {
                        const labelElement = document.getElementById(ariaLabelledBy);
                        if (labelElement) {
                            labelText = labelElement.textContent?.trim() || '';
                        }
                    }
                }
                
                // Priority 3: label[for] attribute
                if (!labelText && field.id) {
                    const label = document.querySelector(`label[for="${field.id}"]`);
                    if (label) labelText = label.textContent?.trim() || '';
                }
                
                // Priority 4: parent label element
                if (!labelText) {
                    const parentLabel = field.closest('label');
                    if (parentLabel) labelText = parentLabel.textContent?.trim() || '';
                }
                
                // Priority 5: preceding sibling label
                if (!labelText) {
                    const prevSibling = field.previousElementSibling;
                    if (prevSibling && prevSibling.tagName === 'LABEL') {
                        labelText = prevSibling.textContent?.trim() || '';
                    }
                }
                
                // Priority 6: placeholder (as fallback)
                if (!labelText) {
                    const placeholder = field.getAttribute('placeholder');
                    if (placeholder) labelText = placeholder;
                }
                
                // Priority 7: title attribute (as fallback)
                if (!labelText) {
                    const title = field.getAttribute('title');
                    if (title) labelText = title;
                }
                
                // Priority 8: data-field-name or data-label (custom attributes)
                if (!labelText) {
                    const dataFieldName = field.getAttribute('data-field-name');
                    const dataLabel = field.getAttribute('data-label');
                    if (dataFieldName) labelText = dataFieldName;
                    else if (dataLabel) labelText = dataLabel;
                }
                
                fields.push({
                    element: field,
                    y: rect.top + scrollY,
                    x: rect.left + scrollX,
                    index: index,
                    labelText: labelText
                });
            });
            
            // Sort by Y position (top to bottom), then by X (left to right)
            fields.sort((a, b) => {
                if (Math.abs(a.y - b.y) < 5) {
                    // Same row, sort by X
                    return a.x - b.x;
                }
                return a.y - b.y;
            });
            
            const result = fields.map((f, sortedIndex) => {
                const field = f.element;
                return {
                    tagName: field.tagName.toLowerCase(),
                    type: field.type || '',
                    name: field.name || '',
                    id: field.id || '',
                    y: f.y,
                    x: f.x,
                    originalIndex: f.index,
                    sortedIndex: sortedIndex,
                    labelText: f.labelText,
                    // Additional attributes for better detection
                    ariaLabel: field.getAttribute('aria-label') || '',
                    ariaLabelledBy: field.getAttribute('aria-labelledby') || '',
                    placeholder: field.getAttribute('placeholder') || '',
                    title: field.getAttribute('title') || '',
                    autocomplete: field.getAttribute('autocomplete') || '',
                    dataFieldType: field.getAttribute('data-field-type') || '',
                    dataType: field.getAttribute('data-type') || '',
                    role: field.getAttribute('role') || '',
                    className: field.className || ''
                };
            });
            
            console.log(`[DEBUG] Returning ${result.length} visible fields after filtering`);
            if (result.length > 0) {
                console.log(`[DEBUG] All fields:`, result.map(f => ({ name: f.name, id: f.id, label: f.labelText, type: f.type, tag: f.tagName })));
            } else {
                console.log(`[DEBUG] WARNING: No fields found! Total inputs were: ${inputs.length}`);
            }
            
            return result;
        });
        
        // Convert to locators
        const fieldLocators = [];
        
        // Add iframe fields first
        fieldLocators.push(...iframeFields);
        
        for (const field of allFields) {
            let selector = null;
            let locator = null;
            
            if (field.id) {
                selector = `${field.tagName}#${field.id}`;
                locator = this.page.locator(selector).first();
            } else if (field.name) {
                if (field.type === 'radio') {
                    selector = `input[name="${field.name}"][type="radio"]`;
                    locator = this.page.locator(selector).first();
                } else {
                    selector = `${field.tagName}[name="${field.name}"]`;
                    locator = this.page.locator(selector).first();
                }
            } else {
                // For fields without id or name, try multiple strategies
                // Strategy 1: Try to find by label text
                if (field.labelText) {
                    try {
                        // Try label with 'for' attribute
                        const labelLocator = this.page.locator(`label:has-text("${field.labelText}")`).first();
                        if (await labelLocator.count() > 0) {
                            const labelFor = await labelLocator.getAttribute('for');
                            if (labelFor) {
                                locator = this.page.locator(`#${labelFor}`).first();
                            } else {
                                // Label without 'for', try to find input inside label
                                locator = labelLocator.locator(`${field.tagName}`).first();
                            }
                        }
                        
                        // If still not found, try aria-label
                        if (!locator || (await locator.count().catch(() => 0)) === 0) {
                            locator = this.page.locator(`${field.tagName}[aria-label*="${field.labelText}"]`).first();
                        }
                        
                        // Try aria-labelledby
                        if (!locator || (await locator.count().catch(() => 0)) === 0) {
                            if (field.ariaLabelledBy) {
                                const labelledByElement = this.page.locator(`#${field.ariaLabelledBy}`).first();
                                if (await labelledByElement.count() > 0) {
                                    // Find input near this element
                                    locator = labelledByElement.locator('xpath=following-sibling::*[1]').first();
                                }
                            }
                        }
                        
                        // Try data attributes
                        if (!locator || (await locator.count().catch(() => 0)) === 0) {
                            if (field.dataFieldType) {
                                locator = this.page.locator(`[data-field-type="${field.dataFieldType}"]`).first();
                            }
                        }
                        
                        // Try by role
                        if (!locator || (await locator.count().catch(() => 0)) === 0) {
                            if (field.role) {
                                locator = this.page.locator(`[role="${field.role}"]`).first();
                            }
                        }
                    } catch (error) {
                        // Continue to next strategy
                    }
                }
                
                // Strategy 2: Use nth() selector based on sorted position
                // Get all visible fields of the same type, sorted by position
                if (!locator || (await locator.count().catch(() => 0)) === 0) {
                    try {
                        const typeSelector = field.type ? `${field.tagName}[type="${field.type}"]` : field.tagName;
                        const allOfType = this.page.locator(`${typeSelector}:not([type="hidden"]):not([type="submit"]):not([type="button"])`);
                        const count = await allOfType.count();
                        if (count > field.sortedIndex) {
                            locator = allOfType.nth(field.sortedIndex);
                        }
                    } catch (error) {
                        // Continue
                    }
                }
            }
            
            if (locator) {
                try {
                    const count = await locator.count();
                    if (count > 0) {
                        // Double-check that the field is visible to the user
                        const isVisible = await locator.isVisible().catch(() => false);
                        if (isVisible) {
                            fieldLocators.push(locator);
                        }
                    }
                } catch (error) {
                    // Skip this field
                }
            }
        }
        
        return fieldLocators;
    }

    /**
     * Get field information (name, id, label, type)
     * @param {Object} locator - Field locator
     * @returns {Promise<Object>} Field info
     */
    async _getFieldInfo(locator) {
        try {
            const name = await locator.getAttribute('name').catch(() => null);
            const id = await locator.getAttribute('id').catch(() => null);
            const placeholder = await locator.getAttribute('placeholder').catch(() => null);
            const ariaLabel = await locator.getAttribute('aria-label').catch(() => null);
            const type = await locator.getAttribute('type').catch(() => null);
            const tagName = await locator.evaluate(el => el.tagName.toLowerCase()).catch(() => null);
            
            // Get label text - try multiple strategies
            let label = null;
            
            // Strategy 1: Label with 'for' attribute pointing to this field's id
            if (id) {
                try {
                    const labelElement = this.page.locator(`label[for="${id}"]`).first();
                    if (await labelElement.count() > 0) {
                        label = await labelElement.textContent();
                    }
                } catch (error) {
                    // Ignore
                }
            }
            
            // Strategy 2: Parent label element
            if (!label) {
                try {
                    const parentLabel = locator.locator('xpath=ancestor::label').first();
                    if (await parentLabel.count() > 0) {
                        label = await parentLabel.textContent();
                    }
                } catch (error) {
                    // Ignore
                }
            }
            
            // Strategy 3: Previous sibling label (common pattern: <label>Text</label><input>)
            if (!label) {
                try {
                    const prevLabel = locator.locator('xpath=preceding-sibling::label[1]').first();
                    if (await prevLabel.count() > 0) {
                        label = await prevLabel.textContent();
                    }
                } catch (error) {
                    // Ignore
                }
            }
            
            // Strategy 4: Find label by text near the field (using position)
            if (!label) {
                try {
                    const fieldPosition = await locator.evaluate(el => {
                        const rect = el.getBoundingClientRect();
                        return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
                    }).catch(() => null);
                    
                    if (fieldPosition) {
                        // Find all labels and check which one is closest to this field
                        const allLabels = await this.page.locator('label').all();
                        for (const labelEl of allLabels) {
                            try {
                                const labelPos = await labelEl.evaluate(el => {
                                    const rect = el.getBoundingClientRect();
                                    return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
                                });
                                
                                // Check if label is above or to the left of the field (within reasonable distance)
                                const isNear = (
                                    (labelPos.y < fieldPosition.y + fieldPosition.height + 10 && labelPos.y + labelPos.height > fieldPosition.y - 10) ||
                                    (labelPos.x < fieldPosition.x + fieldPosition.width + 10 && labelPos.x + labelPos.width > fieldPosition.x - 10)
                                );
                                
                                if (isNear && Math.abs(labelPos.y - fieldPosition.y) < 50) {
                                    const labelText = await labelEl.textContent();
                                    if (labelText && labelText.trim()) {
                                        label = labelText.trim();
                                        break;
                                    }
                                }
                            } catch (error) {
                                continue;
                            }
                        }
                    }
                } catch (error) {
                    // Ignore
                }
            }
            
            // Fallback to aria-label or placeholder
            if (!label) {
                label = ariaLabel || placeholder;
            }
            
            return {
                name,
                id,
                label: label ? label.trim() : null,
                type: type || tagName,
                tagName
            };
        } catch (error) {
            return { name: null, id: null, label: null, type: 'unknown', tagName: null };
        }
    }

    /**
     * Get config value for a field based on its info
     * @param {Object} fieldInfo - Field information
     * @param {Object} personalInfo - Personal info from config
     * @param {Object} filePaths - File paths from config
     * @param {Object} questions - Questions from config
     * @returns {string|null} Config value or null
     */
    _getConfigValueForField(fieldInfo, personalInfo, filePaths, questions, talentPool = null) {
        const name = (fieldInfo.name || '').toLowerCase();
        const id = (fieldInfo.id || '').toLowerCase();
        const label = (fieldInfo.label || '').toLowerCase();
        
        // Map field identifiers to config keys
        const fieldMappings = {
            // First name
            'first_name': personalInfo.first_name,
            'firstname': personalInfo.first_name,
            'vorname': personalInfo.first_name,
            'first name': personalInfo.first_name,
            
            // Last name
            'last_name': personalInfo.last_name,
            'lastname': personalInfo.last_name,
            'nachname': personalInfo.last_name,
            'last name': personalInfo.last_name,
            
            // Email
            'email': personalInfo.email,
            'e-mail': personalInfo.email,
            
            // Phone
            'phone': personalInfo.phone,
            'telephone': personalInfo.phone,
            'telefon': personalInfo.phone,
            
            // Birth date
            'birth_date': personalInfo.birth_date,
            'date_of_birth': personalInfo.birth_date,
            'geburtsdatum': personalInfo.birth_date,
            'birth date': personalInfo.birth_date,
            'date of birth': personalInfo.birth_date,
            
            // Birth year
            'birth_year': personalInfo.birth_year,
            'year': personalInfo.birth_year,
            'geburtsjahr': personalInfo.birth_year,
            
            // Address
            'address': personalInfo.address,
            'adresse': personalInfo.address,
            
            // Street
            'street': personalInfo.street,
            'straße': personalInfo.street,
            
            // Postcode
            'postcode': personalInfo.postcode,
            'postal_code': personalInfo.postcode,
            'zip': personalInfo.postcode,
            'zipcode': personalInfo.postcode,
            'postleitzahl': personalInfo.postcode,
            'plz': personalInfo.postcode,
            
            // Location
            'location': personalInfo.location,
            'standort': personalInfo.location,
            'ort': personalInfo.location,
            
            // Country
            'country': personalInfo.country,
            'land': personalInfo.country,
            
            // Gender
            'gender': personalInfo.gender,
            'sex': personalInfo.gender,
            'geschlecht': personalInfo.gender,
            
            // Comment
            'comment': personalInfo.comment,
            'kommentar': personalInfo.comment,
            'cover_letter_text': personalInfo.cover_letter_text,
            'anschreiben': personalInfo.comment,
            
            // Job experience
            'job_experience': personalInfo.job_experience,
            'professional experience': personalInfo.job_experience,
            'berufserfahrung': personalInfo.job_experience,
            'experience': personalInfo.job_experience,
            
            // Vocational training
            'vocational_training': personalInfo.vocational_training,
            'berufsausbildung': personalInfo.vocational_training,
            'vocational training': personalInfo.vocational_training,
            
            // Graduation (Highest degree)
            'graduation': personalInfo.graduation,
            'highest degree': personalInfo.graduation,
            'höchster abschluss': personalInfo.graduation,
            'degree': personalInfo.graduation,
            'abschluss': personalInfo.graduation,
            
            // Graduated as (University degree as)
            'graduated_as': personalInfo.graduated_as,
            'university degree as': personalInfo.graduated_as,
            'hochschulabschluss als': personalInfo.graduated_as,
            'degree as': personalInfo.graduated_as,
            
            // Language knowledge
            'german_knowledge': personalInfo.german_knowledge,
            'deutsch': personalInfo.german_knowledge,
            'german': personalInfo.german_knowledge,
            'english_knowledge': personalInfo.english_knowledge,
            'englisch': personalInfo.english_knowledge,
            'english': personalInfo.english_knowledge,
            
            // File uploads
            'resume': filePaths.resume,
            'cv': filePaths.resume,
            'lebenslauf': filePaths.resume,
            'lebenslauf / cv': filePaths.resume,
            'cover_letter': filePaths.cover_letter,
            'motivationsschreiben': filePaths.cover_letter,
            'anschreiben': filePaths.cover_letter,
            'file-upload': filePaths.resume,
            'file_app_map': filePaths.resume,
            'file_cover_letter': filePaths.cover_letter,
            'wbnformextension[]': filePaths.resume,
            'wbn-form-extension': filePaths.resume,
            // Photo/Profile picture
            'photo': filePaths.photo,
            'profile': filePaths.photo,
            'profile_picture': filePaths.photo,
            'profile picture': filePaths.photo,
            'foto': filePaths.photo,
            'bild': filePaths.photo,
            'profilbild': filePaths.photo,
            'profil bild': filePaths.photo,
            'file_photo': filePaths.photo,
        };
        
        // Talent pool fields
        if (talentPool) {
            const talentPoolMappings = {
                'job_title': talentPool.job_title,
                'wunschberuf': talentPool.job_title,
                'location': talentPool.location,
                'search_geo': talentPool.location,
                'wunschort': talentPool.location,
                'radius': talentPool.radius,
                'geo_radius': talentPool.radius,
                'salary': talentPool.salary,
                'gehaltswunsch': talentPool.salary,
                'salary_currency': talentPool.salary_currency,
                'salary_type': talentPool.salary_type,
                'job_time_model': talentPool.job_time_model,
                'arbeitszeit': talentPool.job_time_model,
                'job_categories': talentPool.job_categories,
                'kategorie': talentPool.job_categories,
                'career_levels': talentPool.career_levels,
                'karrierestufe': talentPool.career_levels,
            };
            
            // Check talent pool mappings
            if (name && talentPoolMappings[name]) {
                return talentPoolMappings[name];
            }
            if (id && talentPoolMappings[id]) {
                return talentPoolMappings[id];
            }
            if (label) {
                for (const [key, value] of Object.entries(talentPoolMappings)) {
                    if (label.includes(key)) {
                        return value;
                    }
                }
            }
        }
        
        // Check by name
        if (name && fieldMappings[name]) {
            return fieldMappings[name];
        }
        
        // Check by id
        if (id && fieldMappings[id]) {
            return fieldMappings[id];
        }
        
        // Check by label (case-insensitive, exact match or word boundary)
        if (label) {
            const lowerLabel = label.toLowerCase().trim();
            // First, try exact match
            if (fieldMappings[lowerLabel]) {
                return fieldMappings[lowerLabel];
            }
            // Then try partial match with word boundaries to avoid false positives
            // e.g., "Berufsausbildung" should not match "bild" from "profilbild"
            for (const [key, value] of Object.entries(fieldMappings)) {
                const lowerKey = key.toLowerCase();
                // Skip file upload mappings when checking labels (they should only match by name/id)
                if (value && typeof value === 'string' && (value.includes('./doc/') || value.includes('.pdf') || value.includes('.jpg'))) {
                    continue;
                }
                // Exact match
                if (lowerLabel === lowerKey) {
                    return value;
                }
                // Match at word boundaries
                if (lowerLabel.startsWith(lowerKey + ' ') ||
                    lowerLabel.endsWith(' ' + lowerKey) ||
                    lowerLabel.includes(' ' + lowerKey + ' ')) {
                    return value;
                }
            }
        }
        
        // Check questions (for radio buttons and specific question fields)
        // First check by label for specific question fields
        if (label) {
            const lowerLabel = label.toLowerCase().trim();
            // Check for earliest start date field
            if (lowerLabel.includes('frühstmöglicher eintrittstermin') || 
                lowerLabel.includes('fruehstmoeglicher eintrittstermin') ||
                lowerLabel.includes('eintrittstermin') ||
                (lowerLabel.includes('start') && lowerLabel.includes('datum'))) {
                if (questions.earliest_start_date) {
                    return questions.earliest_start_date;
                }
            }
        }
        
        if (name.includes('question_answers')) {
            // Extract question ID from name like "question_answers[173]"
            const questionIdMatch = name.match(/question_answers\[(\d+)\]/);
            if (questionIdMatch) {
                const questionId = questionIdMatch[1];
                
                // Map question IDs to config keys
                const questionIdMap = {
                    '172': 'salary',
                    '173': 'remote_work',
                    '174': 'preferred_location',
                    '176': 'talent_pool',
                    '184': 'earliest_start',
                    '240': 'job_notifications',
                    '241': 'career_notification',
                    '463': 'gender',
                    '553': 'german_level'
                };
                
                const configKey = questionIdMap[questionId];
                if (configKey && questions[configKey]) {
                    return questions[configKey];
                }
            }
            
            // Fallback: Try to match by label text
            for (const [key, value] of Object.entries(questions)) {
                if (label && label.includes(key)) {
                    return value;
                }
            }
        }
        
        // Check by name for earliest_start_date
        if (name && (name.includes('eintrittstermin') || name.includes('start_date') || name.includes('startdate'))) {
            if (questions.earliest_start_date) {
                return questions.earliest_start_date;
            }
        }
        
        return null;
    }

    /**
     * Fill a field based on its info and config value
     * @param {Object} locator - Field locator (can be from main page or iframe)
     * @param {Object} fieldInfo - Field information
     * @param {string} value - Value to fill
     */
    async _fillFieldByInfo(locator, fieldInfo, value) {
        try {
            // Skip if value is empty
            if (!value || value === '' || (typeof value === 'string' && value.trim() === '')) {
                return;
            }
            
            // Check if locator is valid
            if (!locator || await locator.count() === 0) {
                console.log(`⚠️  Locator is invalid or field not found: "${fieldInfo.label || fieldInfo.name}"`);
                return;
            }
            
            // Scroll to field and wait for it to be visible
            try {
                await locator.scrollIntoViewIfNeeded();
                await locator.waitFor({ state: 'visible', timeout: 2000 });
            } catch (error) {
                console.log(`⚠️  Field not visible: "${fieldInfo.label || fieldInfo.name}"`);
            }
            
            // Determine field type and use appropriate filler
            // Check if it's a file upload field (by type, name, or label)
            const nameIsFile = fieldInfo.name?.toLowerCase().includes('file_') ||
                              fieldInfo.name?.toLowerCase().includes('file-') ||
                              fieldInfo.name?.toLowerCase().startsWith('file') ||
                              fieldInfo.name?.toLowerCase() === 'file_app_map' ||
                              fieldInfo.name?.toLowerCase() === 'file_cover_letter' ||
                              fieldInfo.name?.toLowerCase() === 'file_photo';
            
            const labelIsFile = fieldInfo.label?.toLowerCase().includes('lebenslauf') ||
                               fieldInfo.label?.toLowerCase().includes('cv') ||
                               fieldInfo.label?.toLowerCase().includes('motivationsschreiben') ||
                               fieldInfo.label?.toLowerCase().includes('cover letter') ||
                               fieldInfo.label?.toLowerCase().includes('resume') ||
                               (fieldInfo.label?.toLowerCase().includes('photo') && !fieldInfo.label?.toLowerCase().includes('berufsausbildung')) ||
                               (fieldInfo.label?.toLowerCase().includes('profile') && !fieldInfo.label?.toLowerCase().includes('berufsausbildung')) ||
                               (fieldInfo.label?.toLowerCase().includes('foto') && !fieldInfo.label?.toLowerCase().includes('berufsausbildung')) ||
                               fieldInfo.label?.toLowerCase().includes('profilbild');
            
            const isFileField = fieldInfo.type === 'file' || 
                              (fieldInfo.tagName === 'input' && fieldInfo.type === 'file') ||
                              nameIsFile ||
                              labelIsFile;
            
            if (isFileField) {
                console.log(`📁 Detected as file field: name="${fieldInfo.name}", label="${fieldInfo.label}", type="${fieldInfo.type}"`);
                // File upload - use FileUploadFiller (not locator.setInputFiles directly)
                if (typeof value === 'string') {
                    console.log(`📁 Uploading file: ${fieldInfo.label || fieldInfo.name}`);
                    // Build selectors for FileUploadFiller
                    const selectors = [];
                    if (fieldInfo.id) {
                        selectors.push(`#${fieldInfo.id}`);
                    }
                    if (fieldInfo.name) {
                        selectors.push(`[name="${fieldInfo.name}"]`);
                    }
                    // If no selectors found, use name as fallback
                    if (selectors.length === 0 && fieldInfo.name) {
                        selectors.push(`input[name="${fieldInfo.name}"]`);
                    }
                    
                    try {
                        const success = await FileUploadFiller.fill(this.page, selectors, value, fieldInfo.label || fieldInfo.name);
                        if (success) {
                            console.log(`✅ File upload completed: ${fieldInfo.label || fieldInfo.name}`);
                            await this.page.waitForTimeout(2000); // Wait for upload to process
                        } else {
                            console.log(`⚠️  File upload failed: FileUploadFiller returned false`);
                        }
                    } catch (error) {
                        console.log(`⚠️  File upload failed: ${error.message}`);
                    }
                }
            } else if (fieldInfo.tagName === 'select') {
                // Select dropdown - use SelectFieldFiller
                const selector = fieldInfo.id ? `#${fieldInfo.id}` : `[name="${fieldInfo.name}"]`;
                const fieldName = fieldInfo.label || fieldInfo.name || '';
                try {
                    const success = await FieldFiller.fill(this.page, [selector], value, fieldName, 'select');
                    if (!success) {
                        console.log(`⚠️  Error filling select: SelectFieldFiller failed`);
                    }
                } catch (error) {
                    console.log(`⚠️  Error filling select: ${error.message}`);
                }
            } else if (fieldInfo.type === 'radio') {
                // Radio button - need to find by value
                try {
                    const radioLocator = locator.locator(`[value="${value}"]`).first();
                    if (await radioLocator.count() > 0) {
                        await radioLocator.check();
                        console.log(`✅ Radio button selected: "${fieldInfo.label || fieldInfo.name}" = "${value}"`);
                    } else {
                        // Try by label text
                        const labelLocator = locator.locator(`label:has-text("${value}")`).first();
                        if (await labelLocator.count() > 0) {
                            await labelLocator.click();
                            console.log(`✅ Radio button selected (by label): "${fieldInfo.label || fieldInfo.name}" = "${value}"`);
                        }
                    }
                } catch (error) {
                    console.log(`⚠️  Error filling radio: ${error.message}`);
                }
            } else if (fieldInfo.type === 'date' || fieldInfo.name?.includes('date') || fieldInfo.id?.includes('date')) {
                // Date field - use DatePickerFiller with selector
                const selector = fieldInfo.id ? `#${fieldInfo.id}` : `[name="${fieldInfo.name}"]`;
                await FieldFiller.fill(this.page, [selector], value, fieldInfo.label || fieldInfo.name, 'date');
            } else {
                // Text, email, tel, textarea, etc. - use locator directly
                try {
                    await locator.clear();
                    await locator.fill(value);
                    // Verify the value was set
                    const currentValue = await locator.inputValue().catch(() => '');
                    if (currentValue === value || currentValue.includes(value)) {
                        console.log(`✅ Text field filled: "${fieldInfo.label || fieldInfo.name}" = "${value}"`);
                    } else {
                        console.log(`⚠️  Field value mismatch. Expected: "${value}", Got: "${currentValue}"`);
                    }
                } catch (error) {
                    // Fallback to type if fill doesn't work
                    try {
                        await locator.clear();
                        await locator.type(value, { delay: 50 });
                        console.log(`✅ Text field filled (typed): "${fieldInfo.label || fieldInfo.name}" = "${value}"`);
                    } catch (error2) {
                        console.log(`⚠️  Error filling text field: ${error2.message}`);
                    }
                }
            }
        } catch (error) {
            console.log(`⚠️  Error filling field "${fieldInfo.label || fieldInfo.name}": ${error.message}`);
        }
    }

    /**
     * Handle cookie consent popup
     * Accepts cookies by clicking "Accept All" button or close button
     * This must be done BEFORE trying to interact with the form
     */
    async _handleCookieConsent() {
        try {
            // Quick check with timeout: if cookie doesn't appear in 1-2 seconds, it probably doesn't exist
            let cookieExists = false;
            try {
                // Wait max 1.5 seconds for cookie to appear
                await this.page.waitForSelector('#cookiescript_injected_wrapper, #cookiescript_injected', { 
                    timeout: 1500,
                    state: 'visible' 
                });
                cookieExists = true;
            } catch (e) {
                // Timeout - cookie probably doesn't exist
                // But check once more with a quick DOM check to be sure
                const quickCheck = await this.page.evaluate(() => {
                    return !!document.querySelector('#cookiescript_injected_wrapper, #cookiescript_injected');
                });
                
                if (!quickCheck) {
                    // Cookie definitely doesn't exist in DOM
                    return null; // Return null to indicate cookie doesn't exist
                }
                // Cookie exists in DOM but not visible yet - might appear later
                cookieExists = true;
            }

            if (!cookieExists) {
                return null; // Cookie doesn't exist
            }

            // Cookie exists - handle it
            // First, check if cookie consent wrapper exists (high z-index overlay)
            const cookieWrapper = this.page.locator('#cookiescript_injected_wrapper, #cookiescript_injected').first();
            const wrapperCount = await cookieWrapper.count().catch(() => 0);
            
            if (wrapperCount > 0) {
                const isVisible = await cookieWrapper.isVisible().catch(() => false);
                if (isVisible) {
                    console.log('✅ Cookie consent popup detected');
                    
                    // Try to click "Alle akzeptieren" button first (preferred)
                    const acceptButton = this.page.locator('#cookiescript_accept').first();
                    const acceptCount = await acceptButton.count().catch(() => 0);
                    
                    if (acceptCount > 0) {
                        const acceptVisible = await acceptButton.isVisible().catch(() => false);
                        if (acceptVisible) {
                            await acceptButton.scrollIntoViewIfNeeded();
                            await this.page.waitForTimeout(500);
                            await acceptButton.click();
                            console.log('✅ Cookie consent: Clicked "Alle akzeptieren"');
                            await this.page.waitForTimeout(2000); // Wait for popup to close
                            
                            // Verify popup is closed
                            const stillVisible = await cookieWrapper.isVisible().catch(() => false);
                            if (!stillVisible) {
                                console.log('✅ Cookie consent popup closed successfully');
                                return true;
                            }
                        }
                    }
                    
                    // Fallback: Try close button (×)
                    const closeButton = this.page.locator('#cookiescript_close').first();
                    const closeCount = await closeButton.count().catch(() => 0);
                    
                    if (closeCount > 0) {
                        const closeVisible = await closeButton.isVisible().catch(() => false);
                        if (closeVisible) {
                            await closeButton.scrollIntoViewIfNeeded();
                            await this.page.waitForTimeout(500);
                            await closeButton.click();
                            console.log('✅ Cookie consent: Clicked close button (×)');
                            await this.page.waitForTimeout(2000); // Wait for popup to close
                            return true;
                        }
                    }
                }
            }
            
            // Fallback: Try common cookie consent button selectors
            const cookieSelectors = [
                '#cookiescript_accept',
                '#cookiescript_close',
                'button:has-text("ALLE AKZEPTIEREN")',
                'button:has-text("Alle akzeptieren")',
                '[id="cookiescript_accept"]',
                '[id="cookiescript_close"]',
                'div[id="cookiescript_accept"]',
                'div[id="cookiescript_close"]',
                'button:has-text("Accept All")',
                'button:has-text("Akzeptieren")',
                '[id*="cookie"] button:has-text("Akzeptieren")',
                '[class*="cookie"] button:has-text("Akzeptieren")',
                '[class*="cookie-consent"] button:has-text("Akzeptieren")',
                'button[class*="accept"]',
                'button[class*="cookie-accept"]',
                '#cookieConsent button',
                '.cookie-consent button'
            ];

            for (const selector of cookieSelectors) {
                try {
                    const button = this.page.locator(selector).first();
                    const count = await button.count().catch(() => 0);
                    
                    if (count > 0) {
                        const isVisible = await button.isVisible().catch(() => false);
                        if (isVisible) {
                            const buttonText = await button.textContent().catch(() => '');
                            // Skip reject buttons
                            if (buttonText.toLowerCase().includes('ablehnen') || 
                                buttonText.toLowerCase().includes('reject')) {
                                continue;
                            }
                            
                            await button.scrollIntoViewIfNeeded();
                            await this.page.waitForTimeout(500);
                            await button.click();
                            console.log(`✅ Cookie consent handled: clicked "${buttonText.trim() || selector}"`);
                            await this.page.waitForTimeout(2000);
                            
                            // Verify popup is closed
                            const wrapperStillVisible = await cookieWrapper.isVisible().catch(() => false);
                            if (!wrapperStillVisible) {
                                console.log('✅ Cookie consent popup closed successfully');
                                return true;
                            }
                        }
                    }
                } catch (error) {
                    continue;
                }
            }
            
            console.log('ℹ️  No cookie consent popup found or already closed');
            // Check one more time if cookie exists in DOM (might be hidden)
            const finalCheck = await this.page.evaluate(() => {
                return !!document.querySelector('#cookiescript_injected_wrapper, #cookiescript_injected');
            });
            
            if (!finalCheck) {
                return null; // Cookie doesn't exist
            }
            return false; // Cookie might appear later, return false to retry
        } catch (error) {
            console.log(`⚠️  Error handling cookie consent: ${error.message}`);
            return false; // Error - might need to retry
        }
    }

    /**
     * Close popup/modal if exists
     */
    async _closePopup() {
        const popupSelectors = [
            'button[aria-label*="close" i]',
            'button[aria-label*="schließen" i]',
            '.modal-close',
            '.popup-close',
            'button.close',
            '[class*="close"]',
            '[class*="modal"] button',
            'button:has-text("Schließen")',
            'button:has-text("Close")',
            'button:has-text("×")',
            '.btn-close',
            '[data-dismiss="modal"]',
            '[aria-label="Close"]'
        ];

        for (const selector of popupSelectors) {
            try {
                const element = await this.page.waitForSelector(selector, { timeout: 2000 });
                if (element) {
                    await element.click();
                    console.log('✅ Popup closed');
                    await this.page.waitForTimeout(1000);
                    return true;
                }
            } catch (error) {
                continue;
            }
        }
        
        // Try pressing Escape key
        try {
            await this.page.keyboard.press('Escape');
            await this.page.waitForTimeout(500);
            console.log('✅ Tried to close popup with Escape key');
        } catch (error) {
            // Ignore
        }
        
        return false;
    }

    /**
     * Try to find and fill a field using multiple selector strategies.
     * Enhanced with smart field detection for global form support.
     * @param {string[]} selectors - List of CSS selectors to try
     * @param {string} value - Value to fill in the field
     * @param {string} fieldName - Human-readable name for logging
     * @returns {Promise<boolean>} True if field was found and filled
     */
    async _fillField(selectors, value, fieldName = '') {
        for (const selector of selectors) {
            try {
                // Wait for element to be visible and attached to DOM
                const locator = this.page.locator(selector).first();
                await locator.waitFor({ state: 'visible', timeout: 3000 });
                
                // Check if element exists
                const count = await locator.count();
                if (count > 0) {
                    // Scroll element into view
                    await locator.scrollIntoViewIfNeeded();
                    await this.page.waitForTimeout(200);
                    
                    // Focus the element first
                    await locator.focus();
                    await this.page.waitForTimeout(100);
                    
                    // Clear existing value
                    await locator.clear();
                    await this.page.waitForTimeout(100);
                    
                    // Fill the value
                    await locator.fill(value);
                    await this.page.waitForTimeout(100);
                    
                    // Verify the value was set
                    const currentValue = await locator.inputValue();
                    if (currentValue === value || currentValue.includes(value)) {
                        console.log(`✅ ${fieldName || selector}: '${value}'`);
                        return true;
                    } else {
                        // Try typing if fill didn't work
                        await locator.clear();
                        await locator.type(value, { delay: 50 });
                        await this.page.waitForTimeout(100);
                        const typedValue = await locator.inputValue();
                        if (typedValue === value || typedValue.includes(value)) {
                            console.log(`✅ ${fieldName || selector}: '${value}' (typed)`);
                            return true;
                        }
                    }
                }
            } catch (error) {
                // Continue to next selector
                continue;
            }
        }

        // If all selectors failed, try smart field detection
        return await this._smartFieldDetection(fieldName, value);
    }

    /**
     * Smart field detection using label, autocomplete, placeholder, and type attributes
     * This provides global support for any form structure
     * @param {string} fieldName - Field name to search for
     * @param {string} value - Value to fill
     * @returns {Promise<boolean>} True if field was found and filled
     */
    async _smartFieldDetection(fieldName, value) {
        try {
            // Create search terms from field name
            const searchTerms = this._getSearchTerms(fieldName);
            
            // Strategy 1: Find by label text
            for (const term of searchTerms) {
                try {
                    const label = await this.page.locator(`label:has-text("${term}")`).first();
                    const labelFor = await label.getAttribute('for');
                    if (labelFor) {
                        const input = await this.page.locator(`#${labelFor}`);
                        if (await input.count() > 0) {
                            await input.scrollIntoViewIfNeeded();
                            await input.focus();
                            await input.clear();
                            await input.fill(value);
                            console.log(`✅ ${fieldName}: '${value}' (found by label)`);
                            return true;
                        }
                    }
                } catch (error) {
                    continue;
                }
            }

            // Strategy 2: Find by autocomplete attribute
            const autocompleteMap = {
                'first name': 'given-name',
                'vorname': 'given-name',
                'last name': 'family-name',
                'nachname': 'family-name',
                'email': 'email',
                'e-mail': 'email',
                'phone': 'tel',
                'telefon': 'tel',
                'address': 'street-address',
                'comment': 'off'
            };

            for (const [key, autocomplete] of Object.entries(autocompleteMap)) {
                if (fieldName.toLowerCase().includes(key)) {
                    try {
                        const input = await this.page.locator(`input[autocomplete="${autocomplete}"], input[autocomplete*="${autocomplete}"]`).first();
                        if (await input.count() > 0) {
                            await input.scrollIntoViewIfNeeded();
                            await input.focus();
                            await input.clear();
                            await input.fill(value);
                            console.log(`✅ ${fieldName}: '${value}' (found by autocomplete)`);
                            return true;
                        }
                    } catch (error) {
                        continue;
                    }
                }
            }

            // Strategy 3: Find by placeholder text
            for (const term of searchTerms) {
                try {
                    const input = await this.page.locator(`input[placeholder*="${term}" i], textarea[placeholder*="${term}" i]`).first();
                    if (await input.count() > 0) {
                        await input.scrollIntoViewIfNeeded();
                        await input.focus();
                        await input.clear();
                        await input.fill(value);
                        console.log(`✅ ${fieldName}: '${value}' (found by placeholder)`);
                        return true;
                    }
                } catch (error) {
                    continue;
                }
            }

            // Strategy 4: Find by input type
            const typeMap = {
                'email': 'email',
                'e-mail': 'email',
                'phone': 'tel',
                'telefon': 'tel'
            };

            for (const [key, inputType] of Object.entries(typeMap)) {
                if (fieldName.toLowerCase().includes(key)) {
                    try {
                        const input = await this.page.locator(`input[type="${inputType}"]`).first();
                        if (await input.count() > 0) {
                            await input.scrollIntoViewIfNeeded();
                            await input.focus();
                            await input.clear();
                            await input.fill(value);
                            console.log(`✅ ${fieldName}: '${value}' (found by type)`);
                            return true;
                        }
                    } catch (error) {
                        continue;
                    }
                }
            }

            // Strategy 5: Find by name/id containing search terms
            for (const term of searchTerms) {
                try {
                    const input = await this.page.locator(
                        `input[name*="${term}" i], input[id*="${term}" i], textarea[name*="${term}" i], textarea[id*="${term}" i]`
                    ).first();
                    if (await input.count() > 0) {
                        await input.scrollIntoViewIfNeeded();
                        await input.focus();
                        await input.clear();
                        await input.fill(value);
                        console.log(`✅ ${fieldName}: '${value}' (found by name/id)`);
                        return true;
                    }
                } catch (error) {
                    continue;
                }
            }

        } catch (error) {
            // Ignore errors in smart detection
        }

        console.log(`⚠️  ${fieldName || 'Field'} not found (tried all strategies)`);
        return false;
    }

    /**
     * Get search terms from field name for smart detection
     * @param {string} fieldName - Field name
     * @returns {string[]} Array of search terms
     */
    _getSearchTerms(fieldName) {
        const terms = [];
        const lowerName = fieldName.toLowerCase();
        
        // Extract key words
        if (lowerName.includes('first') || lowerName.includes('vorname')) {
            terms.push('first', 'vorname', 'given', 'name');
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
        if (lowerName.includes('address')) {
            terms.push('address', 'adresse', 'street');
        }
        if (lowerName.includes('comment') || lowerName.includes('kommentar')) {
            terms.push('comment', 'kommentar', 'message', 'cover', 'letter');
        }
        
        // Add original field name parts
        const words = fieldName.split(/[\s\-_()]+/).filter(w => w.length > 2);
        terms.push(...words.map(w => w.toLowerCase()));
        
        return [...new Set(terms)]; // Remove duplicates
    }

    /**
     * Fill a datepicker field by actually opening and selecting from calendar
     * @param {string[]} selectors - List of CSS selectors to try
     * @param {string} dateValue - Date value (can be YYYY-MM-DD, DD.MM.YYYY, etc.)
     * @param {string} fieldName - Human-readable name for logging
     * @returns {Promise<boolean>} True if date was filled
     */
    async _fillDatePicker(selectors, dateValue, fieldName = '') {
        // Normalize date format
        const normalizedDate = this._normalizeDate(dateValue);
        const [year, month, day] = normalizedDate.split('-');
        
        for (const selector of selectors) {
            try {
                const locator = this.page.locator(selector).first();
                await locator.waitFor({ state: 'visible', timeout: 2000 });
                
                const count = await locator.count();
                if (count > 0) {
                    // Scroll into view quickly
                    await locator.scrollIntoViewIfNeeded();
                    
                    // Get input type
                    const inputType = await locator.getAttribute('type');
                    
                    if (inputType === 'date') {
                        // HTML5 date input - set value directly (fastest)
                        await locator.evaluate((el, date) => {
                            el.value = date;
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                        }, normalizedDate);
                        
                        const currentValue = await locator.inputValue();
                        if (currentValue === normalizedDate) {
                            console.log(`✅ ${fieldName}: '${normalizedDate}'`);
                            return true;
                        }
                    } else {
                        // Custom datepicker - open calendar and select date
                        // Click to open datepicker
                        await locator.click();
                        await this.page.waitForTimeout(300); // Wait for calendar to open
                        
                        // Try to select date from calendar
                        const dateSelected = await this._selectDateFromCalendar(year, month, day);
                        
                        if (dateSelected) {
                            // Verify the date was set
                            await this.page.waitForTimeout(200);
                            const currentValue = await locator.inputValue();
                            if (currentValue && currentValue.length > 0) {
                                console.log(`✅ ${fieldName}: '${currentValue}' (selected from calendar)`);
                                return true;
                            }
                        }
                        
                        // If calendar selection failed, try direct fill with format detection
                        const formats = this._getDateFormats(year, month, day);
                        for (const format of formats) {
                            try {
                                await locator.clear();
                                await locator.fill(format);
                                await this.page.waitForTimeout(100);
                                await this.page.keyboard.press('Tab');
                                await this.page.waitForTimeout(100);
                                
                                const currentValue = await locator.inputValue();
                                if (currentValue && currentValue.length > 0) {
                                    console.log(`✅ ${fieldName}: '${currentValue}'`);
                                    return true;
                                }
                            } catch (error) {
                                continue;
                            }
                        }
                    }
                }
            } catch (error) {
                continue;
            }
        }

        // Try smart detection (faster timeout)
        return await this._smartDatePickerDetection(fieldName, normalizedDate, year, month, day);
    }

    /**
     * Select date from calendar widget
     * @param {string} year - Year
     * @param {string} month - Month (01-12)
     * @param {string} day - Day (01-31)
     * @returns {Promise<boolean>} True if date was selected
     */
    async _selectDateFromCalendar(year, month, day) {
        try {
            // Remove leading zeros
            const dayNum = parseInt(day, 10);
            const monthNum = parseInt(month, 10);
            const yearNum = parseInt(year, 10);
            
            // Common calendar selectors
            const calendarSelectors = [
                '.calendar',
                '.datepicker',
                '.flatpickr-calendar',
                '.ui-datepicker',
                '[class*="calendar"]',
                '[class*="datepicker"]',
                '[class*="picker"]',
                '.pika-single',
                '.rdt',
                '.react-datepicker'
            ];
            
            // Wait for calendar to appear
            let calendarFound = false;
            for (const calSelector of calendarSelectors) {
                try {
                    const calendar = this.page.locator(calSelector).first();
                    await calendar.waitFor({ state: 'visible', timeout: 1000 });
                    if (await calendar.count() > 0) {
                        calendarFound = true;
                        break;
                    }
                } catch (error) {
                    continue;
                }
            }
            
            if (!calendarFound) {
                return false;
            }
            
            // Try to navigate to correct month/year
            // Look for month/year navigation buttons
            const monthYear = new Date(yearNum, monthNum - 1, 1);
            const monthName = monthYear.toLocaleString('de-DE', { month: 'long' });
            const monthShort = monthYear.toLocaleString('de-DE', { month: 'short' });
            
            // Try clicking month/year if needed
            const navSelectors = [
                `button:has-text("${monthName}")`,
                `button:has-text("${monthShort}")`,
                `[aria-label*="${monthName}"]`,
                `.month:has-text("${monthName}")`,
                `.year:has-text("${year}")`
            ];
            
            // Try to select the day
            const daySelectors = [
                `button:has-text("${dayNum}")`,
                `td:has-text("${dayNum}")`,
                `[data-day="${day}"]`,
                `[data-date="${day}"]`,
                `.day:has-text("${dayNum}")`,
                `button[aria-label*="${dayNum}"]`
            ];
            
            for (const daySelector of daySelectors) {
                try {
                    const dayElement = this.page.locator(daySelector).first();
                    if (await dayElement.count() > 0) {
                        await dayElement.click();
                        await this.page.waitForTimeout(100);
                        return true;
                    }
                } catch (error) {
                    continue;
                }
            }
            
        } catch (error) {
            // Ignore errors
        }
        
        return false;
    }

    /**
     * Get multiple date formats to try
     * @param {string} year - Year
     * @param {string} month - Month
     * @param {string} day - Day
     * @returns {string[]} Array of date formats
     */
    _getDateFormats(year, month, day) {
        const dayNum = parseInt(day, 10);
        const monthNum = parseInt(month, 10);
        
        return [
            `${dayNum}.${monthNum}.${year}`,      // DD.MM.YYYY (German format)
            `${day}.${month}.${year}`,            // DD.MM.YYYY (with leading zeros)
            `${year}-${month}-${day}`,             // YYYY-MM-DD (ISO)
            `${dayNum}/${monthNum}/${year}`,       // DD/MM/YYYY
            `${day}/${month}/${year}`,             // DD/MM/YYYY (with leading zeros)
        ];
    }

    /**
     * Smart datepicker detection using label and common date field names (fast version)
     * @param {string} fieldName - Field name to search for
     * @param {string} dateValue - Date value to fill
     * @param {string} year - Year
     * @param {string} month - Month
     * @param {string} day - Day
     * @returns {Promise<boolean>} True if date was filled
     */
    async _smartDatePickerDetection(fieldName, dateValue, year, month, day) {
        try {
            const searchTerms = ['geburtsdatum', 'birth', 'date', 'datum', 'geburt'];
            const formats = this._getDateFormats(year, month, day);
            
            // Strategy 1: Find by label (fast)
            for (const term of searchTerms) {
                try {
                    const label = await this.page.locator(`label:has-text("${term}") i`).first();
                    const labelFor = await label.getAttribute('for');
                    if (labelFor) {
                        const input = await this.page.locator(`#${labelFor}`).first();
                        if (await input.count() > 0) {
                            await input.scrollIntoViewIfNeeded();
                            
                            // Try opening datepicker
                            await input.click();
                            await this.page.waitForTimeout(200);
                            
                            // Try selecting from calendar
                            const selected = await this._selectDateFromCalendar(year, month, day);
                            if (selected) {
                                console.log(`✅ ${fieldName}: '${dateValue}' (found by label, calendar)`);
                                return true;
                            }
                            
                            // Fallback to direct fill
                            for (const format of formats) {
                                await input.clear();
                                await input.fill(format);
                                await this.page.waitForTimeout(50);
                                await this.page.keyboard.press('Tab');
                                const currentValue = await input.inputValue();
                                if (currentValue && currentValue.length > 0) {
                                    console.log(`✅ ${fieldName}: '${currentValue}' (found by label)`);
                                    return true;
                                }
                            }
                        }
                    }
                } catch (error) {
                    continue;
                }
            }

            // Strategy 2: Find by name/id (fast)
            for (const term of searchTerms) {
                try {
                    const input = await this.page.locator(
                        `input[name*="${term}" i], input[id*="${term}" i], input[placeholder*="${term}" i]`
                    ).first();
                    if (await input.count() > 0) {
                        await input.scrollIntoViewIfNeeded();
                        
                        // Try opening datepicker
                        await input.click();
                        await this.page.waitForTimeout(200);
                        
                        // Try selecting from calendar
                        const selected = await this._selectDateFromCalendar(year, month, day);
                        if (selected) {
                            console.log(`✅ ${fieldName}: '${dateValue}' (found by name/id, calendar)`);
                            return true;
                        }
                        
                        // Fallback to direct fill
                        for (const format of formats) {
                            await input.clear();
                            await input.fill(format);
                            await this.page.waitForTimeout(50);
                            await this.page.keyboard.press('Tab');
                            const currentValue = await input.inputValue();
                            if (currentValue && currentValue.length > 0) {
                                console.log(`✅ ${fieldName}: '${currentValue}' (found by name/id)`);
                                return true;
                            }
                        }
                    }
                } catch (error) {
                    continue;
                }
            }

        } catch (error) {
            // Ignore errors
        }

        console.log(`⚠️  ${fieldName || 'Date field'} not found`);
        return false;
    }

    /**
     * Normalize date to YYYY-MM-DD format
     * @param {string} dateValue - Date in various formats
     * @returns {string} Normalized date in YYYY-MM-DD format
     */
    _normalizeDate(dateValue) {
        if (!dateValue) return '';
        
        // If already in YYYY-MM-DD format
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
            return dateValue;
        }
        
        // If in DD.MM.YYYY format
        if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateValue)) {
            const [day, month, year] = dateValue.split('.');
            return `${year}-${month}-${day}`;
        }
        
        // If in DD/MM/YYYY format
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateValue)) {
            const [day, month, year] = dateValue.split('/');
            return `${year}-${month}-${day}`;
        }
        
        // If only year provided, use first day of year
        if (/^\d{4}$/.test(dateValue)) {
            return `${dateValue}-01-01`;
        }
        
        // Try to parse as Date object
        try {
            const date = new Date(dateValue);
            if (!isNaN(date.getTime())) {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
        } catch (error) {
            // Ignore
        }
        
        // Return as is if can't parse
        return dateValue;
    }

    /**
     * Upload a file to a file input field.
     * @param {string[]} selectors - List of CSS selectors to try
     * @param {string} filePath - Path to the file to upload
     * @param {string} fieldName - Human-readable name for logging
     * @returns {Promise<boolean>} True if file was uploaded
     */
    async _uploadFile(selectors, filePath, fieldName = '') {
        // Convert to absolute path
        const absPath = resolve(filePath);

        if (!existsSync(absPath)) {
            console.error(`❌ File not found: ${absPath}`);
            return false;
        }

        for (const selector of selectors) {
            try {
                const element = await this.page.waitForSelector(selector, {
                    timeout: 2000,
                    state: 'visible'
                });
                
                if (element) {
                    await element.setInputFiles(absPath);
                    console.log(`✅ ${fieldName || 'File'} uploaded: ${absPath.split(/[/\\]/).pop()}`);
                    return true;
                }
            } catch (error) {
                // Continue to next selector
                continue;
            }
        }

        console.log(`⚠️  ${fieldName || 'File upload field'} not found`);
        return false;
    }

    /**
     * Select a radio button by value or label
     * @param {string} nameSelector - Selector for the radio button name
     * @param {string} value - Value to select (can be label text or value)
     * @param {string} fieldName - Human-readable name for logging
     */
    async _selectRadio(nameSelector, value, fieldName = '') {
        try {
            // Try to find radio by value attribute (exact match)
            const valueSelector = `${nameSelector}[value="${value}"]`;
            const element = await this.page.waitForSelector(valueSelector, { timeout: 2000 });
            if (element) {
                await element.check();
                console.log(`✅ ${fieldName}: '${value}'`);
                return true;
            }
        } catch (error) {
            // Try to find by label text
            try {
                const label = await this.page.locator(`label:has-text("${value}")`).first();
                const radioId = await label.getAttribute('for');
                if (radioId) {
                    const radio = await this.page.locator(`#${radioId}`);
                    await radio.check();
                    console.log(`✅ ${fieldName}: '${value}'`);
                    return true;
                }
            } catch (error2) {
                // Try clicking the label directly
                try {
                    const label = await this.page.locator(`label:has-text("${value}")`).first();
                    await label.click();
                    console.log(`✅ ${fieldName}: '${value}'`);
                    return true;
                } catch (error3) {
                    // Try partial text match
                    try {
                        const label = await this.page.locator(`label`).filter({ hasText: value }).first();
                        await label.click();
                        console.log(`✅ ${fieldName}: '${value}'`);
                        return true;
                    } catch (error4) {
                        console.log(`⚠️  ${fieldName} option '${value}' not found`);
                        return false;
                    }
                }
            }
        }
        return false;
    }

    /**
     * Submit the form by clicking the submit button.
     * @returns {Promise<boolean>} True if form was submitted successfully
     */
    async _submitForm() {
        // First, try to find all submit buttons and select the LAST one (bottom button)
        try {
            const allSubmitButtons = await this.page.evaluate(() => {
                const buttons = [];
                // Find all submit buttons (including <a> tags with submit functionality)
                const selectors = [
                    "#submitButton",
                    "a#submitButton",
                    "a[href*='submit']",
                    "a.btn-primary:has-text('Absenden')",
                    "a.btn-primary:has-text('Bewerben')",
                    "button[type='submit']",
                    "input[type='submit']",
                    "button:has-text('Absenden')",
                    "button:has-text('Bewerben')",
                    "button:has-text('Submit')",
                    "button:has-text('Send')",
                    "button:has-text('Senden')",
                    "button.btn-primary:not([disabled])",
                    "[type='submit']:not([disabled])"
                ];
                
                selectors.forEach(selector => {
                    try {
                        const elements = document.querySelectorAll(selector);
                        elements.forEach(el => {
                            const style = window.getComputedStyle(el);
                            if (style.display !== 'none' && style.visibility !== 'hidden') {
                                const text = el.textContent?.trim() || '';
                                // Skip buttons that are not actual submit buttons (like "Hinzufügen" for adding skills)
                                if (text.toLowerCase().includes('hinzufügen') || 
                                    text.toLowerCase().includes('add') ||
                                    text.toLowerCase().includes('erstellen') ||
                                    el.closest('#addNewSkill') ||
                                    el.closest('[id*="add"]')) {
                                    return; // Skip this button
                                }
                                
                                // Check if element is disabled (for both <button> and <a> tags)
                                const isDisabled = el.classList.contains('disabled') || 
                                                  style.pointerEvents === 'none' ||
                                                  el.hasAttribute('disabled') ||
                                                  (el.tagName.toLowerCase() === 'button' && el.disabled);
                                
                                if (!isDisabled) {
                                    const rect = el.getBoundingClientRect();
                                    buttons.push({
                                        element: el,
                                        y: rect.top + rect.height, // Bottom position
                                        text: text,
                                        selector: selector,
                                        tagName: el.tagName.toLowerCase()
                                    });
                                }
                            }
                        });
                    } catch (e) {}
                });
                
                // Sort by Y position (bottom to top) and return the last (bottom) one
                buttons.sort((a, b) => b.y - a.y);
                return buttons.length > 0 ? buttons[0] : null;
            });
            
            if (allSubmitButtons) {
                // Click the bottom submit button (could be <a> or <button>)
                const tagName = allSubmitButtons.tagName || 'button';
                let bottomButton;
                if (tagName === 'a') {
                    bottomButton = this.page.locator(`a#submitButton, a:has-text('${allSubmitButtons.text}')`).last();
                } else {
                    bottomButton = this.page.locator(`button:has-text('${allSubmitButtons.text}'), input[type='submit']`).last();
                }
                if (await bottomButton.count() > 0) {
                    const isVisible = await bottomButton.isVisible().catch(() => false);
                    
                    // For <a> tags, check if it has 'disabled' class or is not clickable
                    let isDisabled = false;
                    if (tagName === 'a') {
                        isDisabled = await bottomButton.evaluate(el => {
                            return el.classList.contains('disabled') || 
                                   window.getComputedStyle(el).pointerEvents === 'none' ||
                                   el.hasAttribute('disabled');
                        }).catch(() => false);
                    } else {
                        isDisabled = await bottomButton.isDisabled().catch(() => false);
                    }
                    
                    if (isVisible && !isDisabled) {
                        await bottomButton.scrollIntoViewIfNeeded();
                        await this.page.waitForTimeout(500);
                        console.log(`✅ Clicking bottom submit button: "${allSubmitButtons.text}"`);
                        await bottomButton.click();
                        console.log('✅ Form submitted');
                        
                        // Wait for response (either success or error)
                        await this.page.waitForTimeout(3000);
                        
                        // Check if form was successfully submitted (URL changed or success message)
                        const hasSuccessMessage = await this._checkForSuccessMessage();
                        if (hasSuccessMessage) {
                            console.log('✅ Form submitted successfully!');
                            return true;
                        }
                        
                        // Check for validation errors
                        const hasErrors = await this._checkForErrors();
                        if (hasErrors) {
                            console.log('⚠️  Validation errors found, attempting to fix...');
                            // Log error details
                            await this._logErrorDetails();
                            const fixed = await this._fixValidationErrors();
                            if (fixed) {
                                // Try submitting again
                                console.log('🔄 Retrying form submission...');
                                await this.page.waitForTimeout(1000);
                                return await this._submitForm();
                            } else {
                                console.log('⚠️  Could not fix all validation errors');
                                return false;
                            }
                        } else {
                            console.log('✅ Form submitted (no errors detected)');
                            return true;
                        }
                    }
                }
            }
        } catch (error) {
            console.log(`⚠️  Error finding bottom submit button: ${error.message}`);
        }
        
        // Fallback: Try original selectors (but use .last() to get bottom button)
        // Also try to find button by text content more flexibly
        // Include <a> tags that act as submit buttons
        const submitSelectors = [
            "#submitButton",
            "a#submitButton",
            "a.btn-primary:has-text('Absenden')",
            "a.btn-primary:has-text('Bewerben')",
            "a[class*='btn'][class*='primary']:has-text('Absenden')",
            "button:has-text('Absenden')",
            "button:has-text('Bewerben')",
            "button[type='submit']",
            "input[type='submit']",
            "button:has-text('Submit')",
            "button:has-text('Send')",
            "button:has-text('Senden')",
            "button.btn-primary:not([disabled])",
            "button[class*='btn'][class*='primary']:not([disabled])",
            "a[class*='btn'][class*='primary']:not([disabled])",
            "[type='submit']:not([disabled])"
        ];

        for (const selector of submitSelectors) {
            try {
                // Try to find all matching buttons
                const allButtons = this.page.locator(selector);
                const count = await allButtons.count();
                
                if (count > 0) {
                    // Get the last (bottom) button
                    const button = allButtons.last();
                    const isVisible = await button.isVisible().catch(() => false);
                    
                    // For <a> tags, check if it has 'disabled' class or is not clickable
                    const tagName = await button.evaluate(el => el.tagName.toLowerCase()).catch(() => '');
                    let isDisabled = false;
                    if (tagName === 'a') {
                        // For <a> tags, check for disabled class or pointer-events: none
                        isDisabled = await button.evaluate(el => {
                            return el.classList.contains('disabled') || 
                                   window.getComputedStyle(el).pointerEvents === 'none' ||
                                   el.hasAttribute('disabled');
                        }).catch(() => false);
                    } else {
                        isDisabled = await button.isDisabled().catch(() => false);
                    }
                    
                    if (isVisible && !isDisabled) {
                        const buttonText = await button.textContent().catch(() => '');
                        // Skip if it's not a real submit button
                        if (buttonText.toLowerCase().includes('hinzufügen') || 
                            buttonText.toLowerCase().includes('add') ||
                            buttonText.toLowerCase().includes('erstellen')) {
                            continue; // Skip this button
                        }
                        
                        await button.scrollIntoViewIfNeeded();
                        await this.page.waitForTimeout(500);
                        console.log(`✅ Clicking submit button (${tagName}): "${buttonText.trim()}"`);
                        await button.click();
                        console.log('✅ Form submitted');
                        
                        // Wait for response (either success or error)
                        await this.page.waitForTimeout(3000);
                        
                        // Check if form was successfully submitted (URL changed or success message)
                        const hasSuccessMessage = await this._checkForSuccessMessage();
                        if (hasSuccessMessage) {
                            console.log('✅ Form submitted successfully!');
                            return true;
                        }
                        
                        // Check for validation errors
                        const hasErrors = await this._checkForErrors();
                        if (hasErrors) {
                            console.log('⚠️  Validation errors found, attempting to fix...');
                            // Log error details
                            await this._logErrorDetails();
                            const fixed = await this._fixValidationErrors();
                            if (fixed) {
                                // Try submitting again
                                console.log('🔄 Retrying form submission...');
                                await this.page.waitForTimeout(1000);
                                return await this._submitForm();
                            } else {
                                console.log('⚠️  Could not fix all validation errors');
                                return false;
                            }
                        } else {
                            console.log('✅ Form submitted (no errors detected)');
                            return true;
                        }
                    }
                }
            } catch (error) {
                continue;
            }
        }

        console.log('⚠️  Submit button not found');
        return false;
    }

    /**
     * Check for validation errors on the page
     * @returns {Promise<boolean>} True if errors found
     */
    async _checkForErrors() {
        try {
            // Common error selectors
            const errorSelectors = [
                '.error',
                '.alert-danger',
                '.alert-error',
                '.validation-error',
                '.field-error',
                '.invalid-feedback',
                '[class*="error"]',
                '[class*="invalid"]',
                '[role="alert"]',
                '.text-danger',
                '.text-error',
                '[aria-invalid="true"]'
            ];

            for (const selector of errorSelectors) {
                const errors = await this.page.locator(selector).all();
                if (errors.length > 0) {
                    // Check if any error is visible
                    for (const error of errors) {
                        const isVisible = await error.isVisible().catch(() => false);
                        if (isVisible) {
                            const errorText = await error.textContent().catch(() => '');
                            if (errorText && errorText.trim().length > 0) {
                                return true;
                            }
                        }
                    }
                }
            }

            // Check for fields with aria-invalid="true"
            const invalidFields = await this.page.locator('[aria-invalid="true"]').all();
            if (invalidFields.length > 0) {
                return true;
            }

            // Check for fields with error classes
            const fieldsWithErrors = await this.page.locator('input.is-invalid, select.is-invalid, textarea.is-invalid').all();
            if (fieldsWithErrors.length > 0) {
                return true;
            }

            return false;
        } catch (error) {
            return false;
        }
    }

    /**
     * Fix validation errors by finding and filling missing/incorrect fields
     * Uses smart error recovery system
     * @returns {Promise<boolean>} True if errors were fixed
     */
    async _fixValidationErrors() {
        // Use smart error recovery instead
        return await this._smartErrorRecovery();
    }

    /**
     * Smart error recovery: Re-scan form, identify errors, and fix them intelligently
     * @returns {Promise<boolean>} True if errors were fixed and form can be resubmitted
     */
    async _smartErrorRecovery() {
        try {
            console.log('\n🔄 Starting smart error recovery...');
            
            const personalInfo = this.config.personal_info || {};
            const filePaths = this.config.file_paths || {};
            const questions = this.config.questions || {};
            const talentPool = this.config.talent_pool || null;
            
            // Step 1: Find all error messages on the page
            const errorData = await this.page.evaluate(() => {
                const errors = [];
                const errorSelectors = [
                    '.invalid-feedback',
                    '.error',
                    '.alert-danger',
                    '.validation-error',
                    '.field-error',
                    '[class*="error"]',
                    '[role="alert"]',
                    '.text-danger',
                    '.js-validation-message',
                    '.text-sm.block.text-danger'
                ];
                
                errorSelectors.forEach(selector => {
                    document.querySelectorAll(selector).forEach(el => {
                        const style = window.getComputedStyle(el);
                        if (style.display !== 'none' && style.visibility !== 'hidden') {
                            const text = el.textContent?.trim() || '';
                            if (text.length > 0) {
                                // Find associated field
                                let field = null;
                                let fieldName = '';
                                let fieldId = '';
                                let fieldLabel = '';
                                let fieldPlaceholder = '';
                                
                                // Strategy 1: Check parent container
                                const parent = el.closest('.form-group, .field, [class*="form"], .col-md-12, .col-md-6, .col-md-5, .col-md-2, .col-md-8');
                                if (parent) {
                                    field = parent.querySelector('input, select, textarea');
                                    if (field) {
                                        fieldName = field.name || '';
                                        fieldId = field.id || '';
                                        fieldPlaceholder = field.placeholder || '';
                                        
                                        // Get label
                                        const label = parent.querySelector('label');
                                        if (label) {
                                            fieldLabel = label.textContent?.trim() || '';
                                        }
                                    }
                                }
                                
                                // Strategy 2: Check aria-describedby
                                if (!field && el.id) {
                                    const fieldByAria = document.querySelector(`[aria-describedby="${el.id}"]`);
                                    if (fieldByAria) {
                                        field = fieldByAria;
                                        fieldName = field.name || '';
                                        fieldId = field.id || '';
                                        fieldPlaceholder = field.placeholder || '';
                                    }
                                }
                                
                                // Strategy 3: Check previous sibling
                                if (!field) {
                                    let sibling = el.previousElementSibling;
                                    while (sibling && !field) {
                                        if (sibling.tagName === 'INPUT' || sibling.tagName === 'SELECT' || sibling.tagName === 'TEXTAREA') {
                                            field = sibling;
                                            fieldName = field.name || '';
                                            fieldId = field.id || '';
                                            fieldPlaceholder = field.placeholder || '';
                                        }
                                        sibling = sibling.previousElementSibling;
                                    }
                                }
                                
                                // Strategy 4: Search by error message keywords
                                if (!field) {
                                    const errorText = text.toLowerCase();
                                    // Try to find field by common error message patterns
                                    if (errorText.includes('vorname') || errorText.includes('first name')) {
                                        field = document.querySelector('input[name*="name"], input[id*="name"], input[placeholder*="Vorname"], input[placeholder*="first"], input[name="first_name"]');
                                    } else if (errorText.includes('nachname') || errorText.includes('last name')) {
                                        field = document.querySelector('input[name*="name2"], input[name*="last"], input[placeholder*="Nachname"], input[placeholder*="last"], input[name="last_name"]');
                                    } else if (errorText.includes('e-mail') || errorText.includes('email')) {
                                        field = document.querySelector('input[type="email"], input[name*="mail"], input[name*="email"], input[placeholder*="E-Mail"], input[placeholder*="email"]');
                                    } else if (errorText.includes('telefon') || errorText.includes('phone')) {
                                        field = document.querySelector('input[type="tel"], input[name*="phone"], input[name*="telefon"], input[placeholder*="Telefon"], input[placeholder*="phone"]');
                                    } else if (errorText.includes('plz') || errorText.includes('zip') || errorText.includes('postal')) {
                                        field = document.querySelector('input[name*="zip"], input[name*="plz"], input[placeholder*="PLZ"], input[placeholder*="zip"]');
                                    } else if (errorText.includes('ort') || errorText.includes('city')) {
                                        field = document.querySelector('input[name*="place"], input[name*="city"], input[name*="ort"], input[placeholder*="Ort"], input[placeholder*="city"]');
                                    } else if (errorText.includes('select') && (errorText.includes('file') || errorText.includes('datei'))) {
                                        // File upload error: "Please select one or more files"
                                        field = document.querySelector('input[type="file"]');
                                        if (!field) {
                                            // Try to find file input by common names
                                            field = document.querySelector('input[name*="file"], input[name*="upload"], input[id*="file"], input[id*="upload"]');
                                        }
                                    }
                                    
                                    if (field) {
                                        fieldName = field.name || '';
                                        fieldId = field.id || '';
                                        fieldPlaceholder = field.placeholder || '';
                                    }
                                }
                                
                                if (field) {
                                    errors.push({
                                        errorText: text,
                                        fieldName: fieldName,
                                        fieldId: fieldId,
                                        fieldLabel: fieldLabel,
                                        fieldPlaceholder: fieldPlaceholder,
                                        fieldType: field.type || field.tagName.toLowerCase(),
                                        fieldValue: field.value || ''
                                    });
                                }
                            }
                        }
                    });
                });
                
                return errors;
            });
            
            console.log(`📋 Found ${errorData.length} error(s) to fix`);
            
            // Step 2: Check for empty required fields
            const emptyRequiredFields = await this.page.evaluate(() => {
                const fields = [];
                const allInputs = document.querySelectorAll('input[required], select[required], textarea[required]');
                
                allInputs.forEach(field => {
                    const value = field.value || '';
                    const isEmpty = value.trim() === '';
                    
                    if (isEmpty) {
                        let label = '';
                        const labelEl = document.querySelector(`label[for="${field.id}"]`);
                        if (labelEl) {
                            label = labelEl.textContent?.trim() || '';
                        }
                        
                        // Also check parent for label
                        if (!label) {
                            const parent = field.closest('.form-group, .field, [class*="form"]');
                            if (parent) {
                                const parentLabel = parent.querySelector('label');
                                if (parentLabel) {
                                    label = parentLabel.textContent?.trim() || '';
                                }
                            }
                        }
                        
                        fields.push({
                            fieldName: field.name || '',
                            fieldId: field.id || '',
                            fieldLabel: label,
                            fieldPlaceholder: field.placeholder || '',
                            fieldType: field.type || field.tagName.toLowerCase(),
                            fieldValue: ''
                        });
                    }
                });
                
                return fields;
            });
            
            console.log(`📋 Found ${emptyRequiredFields.length} empty required field(s)`);
            
            // Combine error data and empty required fields
            const allErrors = [...errorData];
            
            // Add empty required fields that are not already in errorData
            const existingFieldIds = new Set(errorData.map(e => e.fieldId || e.fieldName));
            for (const emptyField of emptyRequiredFields) {
                const fieldId = emptyField.fieldId || emptyField.fieldName;
                if (fieldId && !existingFieldIds.has(fieldId)) {
                    allErrors.push(emptyField);
                }
            }
            
            // Step 3: Fix each error
            let fixedCount = 0;
            const fixedFieldIds = new Set();
            
            for (const error of allErrors) {
                try {
                    // Skip if already fixed
                    const fieldId = error.fieldId || error.fieldName;
                    if (fieldId && fixedFieldIds.has(fieldId)) {
                        continue;
                    }
                    
                    console.log(`\n🔍 Analyzing error: "${error.errorText || 'Empty required field'}"`);
                    console.log(`   Field: name="${error.fieldName}", id="${error.fieldId}", label="${error.fieldLabel}", placeholder="${error.fieldPlaceholder}"`);
                    
                    // Create field info object for config matching
                    const fieldInfo = {
                        name: error.fieldName,
                        id: error.fieldId,
                        label: error.fieldLabel,
                        placeholder: error.fieldPlaceholder,
                        type: error.fieldType
                    };
                    
                    // Find config value for this field
                    const configValue = this._getConfigValueForField(fieldInfo, personalInfo, filePaths, questions, talentPool);
                    
                    if (configValue !== null && configValue !== undefined && configValue !== '') {
                        console.log(`   ✅ Found config value: "${configValue}"`);
                        
                        // Find the field locator
                        let fieldLocator = null;
                        if (error.fieldId) {
                            fieldLocator = this.page.locator(`#${error.fieldId}`).first();
                        } else if (error.fieldName) {
                            fieldLocator = this.page.locator(`[name="${error.fieldName}"]`).first();
                        }
                        
                        if (fieldLocator && await fieldLocator.count() > 0) {
                            const fieldInfoFull = await this._getFieldInfo(fieldLocator);
                            console.log(`🔧 Fixing field: "${fieldInfoFull.label || fieldInfoFull.name || error.fieldLabel}"`);
                            await this._fillFieldByInfo(fieldLocator, fieldInfoFull, configValue);
                            fixedCount++;
                            fixedFieldIds.add(fieldId);
                            await this.page.waitForTimeout(500);
                        } else {
                            console.log(`   ⚠️  Field not found by id/name, trying smart detection...`);
                            // Try smart field detection
                            const detected = await this._smartFieldDetection(error);
                            if (detected) {
                                fixedCount++;
                                fixedFieldIds.add(fieldId);
                            }
                        }
                    } else {
                        console.log(`   ⚠️  No config value found for this field`);
                        // Try smart field detection as fallback
                        const detected = await this._smartFieldDetection(error);
                        if (detected) {
                            fixedCount++;
                            fixedFieldIds.add(fieldId);
                        }
                    }
                } catch (error) {
                    console.log(`   ⚠️  Error fixing field: ${error.message}`);
                    continue;
                }
            }
            
            console.log(`\n✅ Fixed ${fixedCount} field(s) out of ${allErrors.length} error(s)`);
            
            // Step 4: Check for file upload errors specifically
            console.log(`\n🔍 Checking for file upload errors...`);
            const fileUploadErrors = await this.page.evaluate(() => {
                const errors = [];
                const errorSelectors = [
                    '.invalid-feedback',
                    '.error',
                    '.alert-danger',
                    '[class*="error"]',
                    '[role="alert"]'
                ];
                
                errorSelectors.forEach(selector => {
                    document.querySelectorAll(selector).forEach(el => {
                        const style = window.getComputedStyle(el);
                        if (style.display !== 'none' && style.visibility !== 'hidden') {
                            const text = el.textContent?.trim() || '';
                            const lowerText = text.toLowerCase();
                            // Check for file upload error messages
                            if (lowerText.includes('select') && (lowerText.includes('file') || lowerText.includes('datei'))) {
                                // Find file input nearby
                                const parent = el.closest('.form-group, .field, [class*="form"]');
                                if (parent) {
                                    const fileInput = parent.querySelector('input[type="file"]');
                                    if (fileInput) {
                                        errors.push({
                                            fieldName: fileInput.name || '',
                                            fieldId: fileInput.id || '',
                                            fieldLabel: '',
                                            errorText: text
                                        });
                                    }
                                }
                            }
                        }
                    });
                });
                
                return errors;
            });
            
            // Handle file upload errors
            for (const fileError of fileUploadErrors) {
                try {
                    const fieldId = fileError.fieldId || fileError.fieldName;
                    if (fieldId && fixedFieldIds.has(fieldId)) {
                        continue;
                    }
                    
                    // Try to find file input
                    let fileLocator = null;
                    if (fileError.fieldId) {
                        fileLocator = this.page.locator(`input[type="file"]#${fileError.fieldId}`).first();
                    } else if (fileError.fieldName) {
                        fileLocator = this.page.locator(`input[type="file"][name="${fileError.fieldName}"]`).first();
                    } else {
                        // Try common file input selectors
                        fileLocator = this.page.locator('input[type="file"]').first();
                    }
                    
                    if (fileLocator && await fileLocator.count() > 0) {
                        // Determine which file to upload based on field name/label
                        // Priority: CV/Resume is always the default if we can't determine the type
                        let fileToUpload = null;
                        const fieldNameLower = (fileError.fieldName || '').toLowerCase();
                        const fieldIdLower = (fileError.fieldId || '').toLowerCase();
                        
                        if (fieldNameLower.includes('resume') || fieldNameLower.includes('cv') || fieldNameLower.includes('lebenslauf') || 
                            fieldIdLower.includes('resume') || fieldIdLower.includes('cv') || fieldIdLower.includes('lebenslauf')) {
                            fileToUpload = filePaths.resume;
                        } else if (fieldNameLower.includes('cover') || fieldNameLower.includes('letter') || fieldNameLower.includes('motivation') ||
                                   fieldIdLower.includes('cover') || fieldIdLower.includes('letter') || fieldIdLower.includes('motivation')) {
                            fileToUpload = filePaths.cover_letter;
                        } else if (fieldNameLower.includes('photo') || fieldNameLower.includes('foto') || fieldNameLower.includes('bild') ||
                                   fieldIdLower.includes('photo') || fieldIdLower.includes('foto') || fieldIdLower.includes('bild')) {
                            fileToUpload = filePaths.photo;
                        } else {
                            // Default: Always use CV/Resume if we can't determine the file type
                            fileToUpload = filePaths.resume;
                        }
                        
                        if (fileToUpload) {
                            const fileFieldInfo = await this._getFieldInfo(fileLocator);
                            console.log(`📁 Uploading file for error: "${fileError.fieldName || fileError.fieldId}" = "${fileToUpload}" (default: CV/Resume)`);
                            await this._fillFieldByInfo(fileLocator, fileFieldInfo, fileToUpload);
                            fixedCount++;
                            if (fieldId) fixedFieldIds.add(fieldId);
                            await this.page.waitForTimeout(1000);
                        }
                    }
                } catch (error) {
                    console.log(`⚠️  Error handling file upload: ${error.message}`);
                }
            }
            
            // Step 5: After fixing errors, check ALL form fields and fill any that have config values
            console.log(`\n🔍 Checking all form fields for available config data...`);
            const allFormFields = await this._getFormFieldsInOrder();
            let additionalFilled = 0;
            
            for (const { locator, fieldInfo } of allFormFields) {
                try {
                    // Skip if already fixed
                    const fieldId = fieldInfo.id || fieldInfo.name;
                    if (fieldId && fixedFieldIds.has(fieldId)) {
                        continue;
                    }
                    
                    // Check if field is empty
                    const isEmpty = await locator.evaluate(el => {
                        if (el.tagName === 'SELECT') {
                            return !el.value || el.value === '';
                        }
                        if (el.type === 'file') {
                            // For file inputs, check if files are selected
                            return !el.files || el.files.length === 0;
                        }
                        return !el.value || el.value.trim() === '';
                    }).catch(() => true);
                    
                    if (isEmpty) {
                        // Get config value for this field
                        let configValue = this._getConfigValueForField(fieldInfo, personalInfo, filePaths, questions, talentPool);
                        
                        // For file upload fields, if no config value found, default to resume/CV
                        if (!configValue && fieldInfo.type === 'file') {
                            configValue = filePaths.resume;
                            console.log(`📁 No specific file mapping found, using default: CV/Resume`);
                        }
                        
                        if (configValue !== null && configValue !== undefined && configValue !== '') {
                            console.log(`🔧 Filling additional field: "${fieldInfo.label || fieldInfo.name}" = "${configValue}"`);
                            await this._fillFieldByInfo(locator, fieldInfo, configValue);
                            additionalFilled++;
                            fixedFieldIds.add(fieldId);
                            await this.page.waitForTimeout(300);
                        }
                    }
                } catch (error) {
                    continue;
                }
            }
            
            if (additionalFilled > 0) {
                console.log(`✅ Additionally filled ${additionalFilled} field(s)`);
            }
            
            if (fixedCount > 0 || additionalFilled > 0) {
                // Wait a bit for validation to update
                await this.page.waitForTimeout(1000);
            }
            
            return (fixedCount > 0 || additionalFilled > 0);
            
        } catch (error) {
            console.log(`⚠️  Error in smart error recovery: ${error.message}`);
            return false;
        }
    }

    /**
     * Smart field detection based on error message and field attributes
     * @param {Object} error - Error data object
     * @returns {Promise<boolean>} True if field was found and filled
     */
    async _smartFieldDetection(error) {
        try {
            const personalInfo = this.config.personal_info || {};
            const filePaths = this.config.file_paths || {};
            const questions = this.config.questions || {};
            
            const errorText = (error.errorText || '').toLowerCase();
            const fieldLabel = (error.fieldLabel || '').toLowerCase();
            const fieldPlaceholder = (error.fieldPlaceholder || '').toLowerCase();
            const fieldName = (error.fieldName || '').toLowerCase();
            
            // Map error messages and field attributes to config keys
            let configKey = null;
            let configValue = null;
            
            // Vorname / First Name
            if (errorText.includes('vorname') || fieldLabel.includes('vorname') || 
                fieldPlaceholder.includes('vorname') || (fieldName.includes('name') && !fieldName.includes('name2') && !fieldName.includes('last'))) {
                configValue = personalInfo.first_name;
                configKey = 'first_name';
            }
            // Nachname / Last Name
            else if (errorText.includes('nachname') || fieldLabel.includes('nachname') || 
                     fieldPlaceholder.includes('nachname') || fieldName.includes('name2') || fieldName.includes('last')) {
                configValue = personalInfo.last_name;
                configKey = 'last_name';
            }
            // Email
            else if (errorText.includes('e-mail') || errorText.includes('email') || 
                     fieldLabel.includes('e-mail') || fieldPlaceholder.includes('e-mail') || 
                     fieldName.includes('mail') || fieldName.includes('email')) {
                configValue = personalInfo.email;
                configKey = 'email';
            }
            // Phone
            else if (errorText.includes('telefon') || fieldLabel.includes('telefon') || 
                     fieldPlaceholder.includes('telefon') || fieldName.includes('phone') || fieldName.includes('telefon')) {
                configValue = personalInfo.phone;
                configKey = 'phone';
            }
            // PLZ / Zip
            else if (errorText.includes('plz') || fieldLabel.includes('plz') || 
                     fieldPlaceholder.includes('plz') || fieldName.includes('zip') || fieldName.includes('plz')) {
                configValue = personalInfo.postcode || personalInfo.zip;
                configKey = 'postcode';
            }
            // Ort / City
            else if (errorText.includes('ort') || fieldLabel.includes('ort') || 
                     fieldPlaceholder.includes('ort') || fieldName.includes('place') || fieldName.includes('city') || fieldName.includes('ort')) {
                configValue = personalInfo.location || personalInfo.city;
                configKey = 'location';
            }
            // Street
            else if (fieldLabel.includes('straße') || fieldPlaceholder.includes('straße') || 
                     fieldName.includes('street') || fieldName.includes('straße')) {
                configValue = personalInfo.street;
                configKey = 'street';
            }
            // Salary
            else if (fieldLabel.includes('gehalt') || fieldPlaceholder.includes('gehalt') || 
                     fieldName.includes('salary') || fieldName.includes('gehalt')) {
                configValue = questions.salary;
                configKey = 'salary';
            }
            // Birth Date
            else if (errorText.includes('geburtsdatum') || fieldLabel.includes('geburtsdatum') || 
                     fieldPlaceholder.includes('geburtsdatum') || fieldName.includes('birth') || fieldName.includes('date_of_birth')) {
                configValue = personalInfo.birth_date;
                configKey = 'birth_date';
            }
            
            if (configValue) {
                // Priority 1: Use the fieldId and fieldName from error (most reliable)
                let fieldLocator = null;
                let fieldInfo = null;
                
                // Try to find field using error data first
                if (error.fieldId) {
                    try {
                        fieldLocator = this.page.locator(`#${error.fieldId}`).first();
                        if (await fieldLocator.count() > 0) {
                            fieldInfo = await this._getFieldInfo(fieldLocator);
                        } else {
                            fieldLocator = null;
                        }
                    } catch (e) {
                        // Try in iframes
                        const iframes = await this.page.locator('iframe').all();
                        for (const iframe of iframes) {
                            try {
                                const frame = await iframe.contentFrame();
                                if (frame) {
                                    fieldLocator = frame.locator(`#${error.fieldId}`).first();
                                    if (await fieldLocator.count() > 0) {
                                        fieldInfo = await this._getFieldInfo(fieldLocator);
                                        break;
                                    }
                                }
                            } catch (err) {
                                continue;
                            }
                        }
                    }
                }
                
                if (!fieldLocator && error.fieldName) {
                    try {
                        fieldLocator = this.page.locator(`[name="${error.fieldName}"]`).first();
                        if (await fieldLocator.count() > 0) {
                            fieldInfo = await this._getFieldInfo(fieldLocator);
                        } else {
                            fieldLocator = null;
                        }
                    } catch (e) {
                        // Try in iframes
                        const iframes = await this.page.locator('iframe').all();
                        for (const iframe of iframes) {
                            try {
                                const frame = await iframe.contentFrame();
                                if (frame) {
                                    fieldLocator = frame.locator(`[name="${error.fieldName}"]`).first();
                                    if (await fieldLocator.count() > 0) {
                                        fieldInfo = await this._getFieldInfo(fieldLocator);
                                        break;
                                    }
                                }
                            } catch (err) {
                                continue;
                            }
                        }
                    }
                }
                
                // Priority 2: If found, fill it
                if (fieldLocator && fieldInfo) {
                    console.log(`   ✅ Found field by error data (id="${error.fieldId}", name="${error.fieldName}"), filling with ${configKey}: "${configValue}"`);
                    await this._fillFieldByInfo(fieldLocator, fieldInfo, configValue);
                    await this.page.waitForTimeout(500);
                    return true;
                }
                
                // Priority 3: Fallback to common selectors
                const selectors = [];
                if (error.fieldPlaceholder) selectors.push(`[placeholder*="${error.fieldPlaceholder}"]`);
                
                // Add common selectors based on field type
                if (configKey === 'first_name') {
                    selectors.push('input[name="first_name"]', 'input[id="first_name"]', 'input[autocomplete="given-name"]', 'input[name="name"]');
                } else if (configKey === 'last_name') {
                    selectors.push('input[name="last_name"]', 'input[id="last_name"]', 'input[autocomplete="family-name"]', 'input[name="name2"]');
                } else if (configKey === 'email') {
                    selectors.push('input[type="email"]', 'input[name="email"]', 'input[id="email"]', 'input[name="mail"]');
                } else if (configKey === 'phone') {
                    selectors.push('input[type="tel"]', 'input[name="telephone"]', 'input[name="phone"]');
                }
                
                for (const selector of selectors) {
                    try {
                        fieldLocator = this.page.locator(selector).first();
                        if (await fieldLocator.count() > 0) {
                            fieldInfo = await this._getFieldInfo(fieldLocator);
                            console.log(`   ✅ Found field by fallback selector, filling with ${configKey}: "${configValue}"`);
                            await this._fillFieldByInfo(fieldLocator, fieldInfo, configValue);
                            await this.page.waitForTimeout(500);
                            return true;
                        }
                    } catch (error) {
                        continue;
                    }
                }
            }
            
            return false;
        } catch (error) {
            return false;
        }
    }

    /**
     * Log error details for debugging
     */
    async _logErrorDetails() {
        try {
            // Find all error messages
            const errorMessages = await this.page.evaluate(() => {
                const errors = [];
                const errorSelectors = [
                    '.error',
                    '.alert-danger',
                    '.validation-error',
                    '.field-error',
                    '.invalid-feedback',
                    '[class*="error"]',
                    '[role="alert"]',
                    '.text-danger'
                ];

                errorSelectors.forEach(selector => {
                    document.querySelectorAll(selector).forEach(el => {
                        const style = window.getComputedStyle(el);
                        if (style.display !== 'none' && style.visibility !== 'hidden') {
                            const text = el.textContent?.trim() || '';
                            if (text.length > 0) {
                                errors.push(text);
                            }
                        }
                    });
                });

                // Find invalid fields
                const invalidFields = Array.from(document.querySelectorAll('[aria-invalid="true"], .is-invalid'));
                invalidFields.forEach(field => {
                    const label = field.getAttribute('aria-label') || 
                                 field.getAttribute('name') || 
                                 field.getAttribute('id') || 
                                 'Unknown field';
                    errors.push(`Invalid field: ${label}`);
                });

                return [...new Set(errors)];
            });

            if (errorMessages.length > 0) {
                console.log('\n📋 Error details:');
                errorMessages.forEach((error, index) => {
                    console.log(`   ${index + 1}. ${error.substring(0, 100)}${error.length > 100 ? '...' : ''}`);
                });
                console.log('');
            }
        } catch (error) {
            // Ignore
        }
    }

    /**
     * Check for success message after form submission
     * @returns {Promise<boolean>} True if success message found
     */
    async _checkForSuccessMessage() {
        try {
            const successSelectors = [
                '.success',
                '.alert-success',
                '.success-message',
                '[class*="success"]',
                'h1:has-text("Thank")',
                'h1:has-text("Success")',
                'h1:has-text("Erfolg")',
                'h1:has-text("Danke")'
            ];

            for (const selector of successSelectors) {
                const element = this.page.locator(selector).first();
                if (await element.count() > 0) {
                    const isVisible = await element.isVisible().catch(() => false);
                    if (isVisible) {
                        return true;
                    }
                }
            }

            return false;
        } catch (error) {
            return false;
        }
    }

    /**
     * Handle errors by taking a screenshot.
     */
    async _handleError() {
        const screenshotOnError = this.config.settings?.screenshot_on_error !== false;
        if (screenshotOnError) {
            try {
                await this.page.screenshot({ 
                    path: 'error_screenshot.png', 
                    fullPage: true 
                });
                console.log('📸 Error screenshot saved: error_screenshot.png');
            } catch (error) {
                // Ignore screenshot errors
            }
        }
    }
}

/**
 * Main entry point for the script.
 * Modify the URL and settings as needed.
 */
async function main() {
    // Initialize form filler
    const filler = new FormFiller('config.json');

    // URL of the form page
    // Previous URL (commented out):
    // const url = 'https://www.finest-jobs.com/Bewerbung/Sales-Manager-D-Online-Marketing-727662?cp=BA';
    
    // New URL (commented out):
    // const url = 'https://www.heckertsolar.com/vertriebsaussendienst-m-w-d-dtld.-suedost/sw10146#custom-form-anchor';
    const url = 'https://www.empfehlungsbund.de/jobs/283194/solution-manager-w-strich-m-strich-x';
    
    // Original URL (empfehlungsbund.de):
    // const url = 'https://www.empfehlungsbund.de/jobs/283194/solution-manager-w-strich-m-strich-x';

    // Fill the form (set autoSubmit=true to automatically submit)
    await filler.fillForm(url, true);
}

// Run the script
main().catch(console.error);

