/**
 * Main Field Filler Module
 * Routes to appropriate filler based on field type
 */

import { FieldDetector } from './FieldDetector.js';
import { TextFieldFiller } from './TextFieldFiller.js';
import { DatePickerFiller } from './DatePickerFiller.js';
import { SelectFieldFiller } from './SelectFieldFiller.js';
import { RadioFieldFiller } from './RadioFieldFiller.js';
import { FileUploadFiller } from './FileUploadFiller.js';
import { CheckboxFieldFiller } from './CheckboxFieldFiller.js';
import { RangeFiller } from './RangeFiller.js';
import { AutocompleteFiller } from './AutocompleteFiller.js';
import { RichTextFiller } from './RichTextFiller.js';

export class FieldFiller {
    /**
     * Fill a field automatically based on its type
     * @param {Object} page - Playwright page object
     * @param {string[]} selectors - List of CSS selectors to try
     * @param {string|boolean} value - Value to fill
     * @param {string} fieldName - Field name for logging
     * @param {string} fieldType - Optional field type override
     * @returns {Promise<boolean>} True if filled successfully
     */
    static async fill(page, selectors, value, fieldName = '', fieldType = null) {
        // Try each selector with fast timeout
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
                    // Detect field type if not provided
                    const detectedType = fieldType || await FieldDetector.detectType(locator);
                    
                    // Skip hidden inputs
                    if (detectedType === 'hidden') {
                        continue;
                    }
                    
                    // Route to appropriate filler
                    switch (detectedType) {
                        case 'date':
                        case 'time':
                            return await DatePickerFiller.fill(page, [selector], value, fieldName);
                        
                        case 'select':
                            return await SelectFieldFiller.fill(page, [selector], value, fieldName);
                        
                        case 'radio':
                            return await RadioFieldFiller.fill(page, selector, value, fieldName);
                        
                        case 'checkbox':
                            return await CheckboxFieldFiller.fill(page, [selector], value === true || value === 'true', fieldName);
                        
                        case 'file':
                            return await FileUploadFiller.fill(page, [selector], value, fieldName);
                        
                        case 'range':
                            return await RangeFiller.fill(page, [selector], value, fieldName);
                        
                        case 'autocomplete':
                            return await AutocompleteFiller.fill(page, [selector], value, fieldName);
                        
                        case 'richtext':
                            return await RichTextFiller.fill(page, [selector], value, fieldName);
                        
                        case 'textarea':
                        case 'text':
                        case 'email':
                        case 'tel':
                        case 'url':
                        case 'number':
                        case 'password':
                        default:
                            return await TextFieldFiller.fill(page, [selector], value, fieldName);
                    }
                }
            } catch (error) {
                continue;
            }
        }
        
        // If all selectors failed, try smart detection
        return await this._smartFill(page, fieldName, value, fieldType);
    }

    /**
     * Smart fill using field name and type hints
     * @param {Object} page - Playwright page object
     * @param {string} fieldName - Field name
     * @param {string|boolean} value - Value to fill
     * @param {string} fieldType - Field type hint
     * @returns {Promise<boolean>} True if filled successfully
     */
    static async _smartFill(page, fieldName, value, fieldType = null) {
        const lowerName = fieldName.toLowerCase();
        
        // Determine type from field name if not provided
        if (!fieldType) {
            if (lowerName.includes('date') || lowerName.includes('datum') || lowerName.includes('geburt')) {
                fieldType = 'date';
            } else if (lowerName.includes('select') || lowerName.includes('dropdown')) {
                fieldType = 'select';
            } else if (lowerName.includes('radio')) {
                fieldType = 'radio';
            } else if (lowerName.includes('checkbox') || lowerName.includes('check')) {
                fieldType = 'checkbox';
            } else if (lowerName.includes('file') || lowerName.includes('upload')) {
                fieldType = 'file';
            }
        }
        
        // Route to appropriate smart filler
        switch (fieldType) {
            case 'date':
                // DatePickerFiller has its own smart detection
                return await DatePickerFiller.fill(page, [], value, fieldName);
            
            case 'select':
                return await SelectFieldFiller.fill(page, [], value, fieldName);
            
            case 'radio':
                // Radio needs name selector, try to find it
                const searchTerms = ['geburtsdatum', 'birth', 'date', 'datum'];
                for (const term of searchTerms) {
                    if (lowerName.includes(term)) {
                        // This would need the actual name selector from config
                        // For now, return false
                        break;
                    }
                }
                return false;
            
            case 'file':
                return await FileUploadFiller.fill(page, [], value, fieldName);
            
            default:
                return await TextFieldFiller.smartFill(page, fieldName, value);
        }
    }
}

