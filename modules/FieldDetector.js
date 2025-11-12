/**
 * Field Detector Module
 * Detects the type of form field automatically
 */

export class FieldDetector {
    /**
     * Detect field type from element
     * @param {Object} locator - Playwright locator
     * @returns {Promise<string>} Field type (text, email, tel, date, select, radio, checkbox, file, textarea)
     */
    static async detectType(locator) {
        try {
            // Get tag name
            const tagName = await locator.evaluate(el => el.tagName.toLowerCase());
            
            // Get input type
            const inputType = await locator.getAttribute('type');
            
            // Check for select
            if (tagName === 'select') {
                return 'select';
            }
            
            // Check for textarea
            if (tagName === 'textarea') {
                return 'textarea';
            }
            
            // Check input types
            if (tagName === 'input') {
                // Skip hidden inputs
                if (inputType === 'hidden' || inputType === 'submit' || inputType === 'button') {
                    return 'hidden';
                }
                
                if (inputType === 'file') {
                    return 'file';
                }
                if (inputType === 'date' || inputType === 'datetime-local') {
                    return 'date';
                }
                if (inputType === 'time') {
                    return 'time';
                }
                if (inputType === 'email') {
                    return 'email';
                }
                if (inputType === 'tel') {
                    return 'tel';
                }
                if (inputType === 'url') {
                    return 'url';
                }
                if (inputType === 'radio') {
                    return 'radio';
                }
                if (inputType === 'checkbox') {
                    return 'checkbox';
                }
                if (inputType === 'number') {
                    return 'number';
                }
                if (inputType === 'password') {
                    return 'password';
                }
                if (inputType === 'range') {
                    return 'range';
                }
                
                // Check for custom components by role or data attributes
                const role = await locator.getAttribute('role');
                const className = await locator.getAttribute('class');
                const contentEditable = await locator.getAttribute('contenteditable');
                const dataFieldType = await locator.getAttribute('data-field-type');
                const ariaAutocomplete = await locator.getAttribute('aria-autocomplete');
                
                // Check data-field-type attribute
                if (dataFieldType) {
                    const fieldTypeMap = {
                        'email': 'email',
                        'tel': 'tel',
                        'url': 'url',
                        'number': 'number',
                        'date': 'date',
                        'text': 'text',
                        'password': 'password'
                    };
                    if (fieldTypeMap[dataFieldType]) {
                        return fieldTypeMap[dataFieldType];
                    }
                }
                
                // Check for WYSIWYG editors
                if (contentEditable === 'true' || className?.includes('ql-editor') || className?.includes('mce-content-body')) {
                    return 'richtext';
                }
                
                // Check for autocomplete/typeahead by role or aria attributes
                if (role === 'combobox' || role === 'searchbox' || 
                    ariaAutocomplete === 'list' || ariaAutocomplete === 'both' ||
                    className?.includes('autocomplete') || className?.includes('typeahead') || className?.includes('selectize')) {
                    return 'autocomplete';
                }
                
                // Check for textbox role (contenteditable)
                if (role === 'textbox' && contentEditable === 'true') {
                    return 'richtext';
                }
                
                // Check for spinbutton role (numeric input)
                if (role === 'spinbutton') {
                    return 'number';
                }
                
                // Check for slider role
                if (role === 'slider') {
                    return 'range';
                }
                
                // Check for switch role
                if (role === 'switch') {
                    return 'checkbox';
                }
                
                // Check for datepicker by class or attributes
                const hasDatePicker = className && (
                    className.includes('datepicker') ||
                    className.includes('date-picker') ||
                    className.includes('calendar') ||
                    className.includes('flatpickr') ||
                    className.includes('air-datepicker') ||
                    className.includes('react-datepicker')
                );
                
                if (hasDatePicker) {
                    return 'date';
                }
                
                // Check for toggle switch (custom checkbox)
                if (className?.includes('toggle') || className?.includes('switch')) {
                    return 'checkbox';
                }
                
                // Default to text
                return 'text';
            }
            
            // Check for contentEditable divs (rich text editors)
            if (tagName === 'div') {
                const contentEditable = await locator.getAttribute('contenteditable');
                const className = await locator.getAttribute('class');
                const role = await locator.getAttribute('role');
                
                // Check by role first
                if (role === 'textbox' && contentEditable === 'true') {
                    return 'richtext';
                }
                if (role === 'combobox' || role === 'listbox') {
                    return 'select';
                }
                if (role === 'slider') {
                    return 'range';
                }
                
                if (contentEditable === 'true' || className?.includes('ql-editor') || className?.includes('mce-content-body') || className?.includes('ck-content')) {
                    return 'richtext';
                }
                
                // Check for custom select components (Tagify, Multiselect)
                if (className?.includes('tagify') || className?.includes('multiselect') || className?.includes('selectize')) {
                    return 'select';
                }
            }
            
            // Check for elements with role attributes
            const role = await locator.getAttribute('role');
            if (role) {
                const roleTypeMap = {
                    'textbox': 'text',
                    'combobox': 'autocomplete',
                    'listbox': 'select',
                    'searchbox': 'autocomplete',
                    'spinbutton': 'number',
                    'slider': 'range',
                    'checkbox': 'checkbox',
                    'radio': 'radio',
                    'switch': 'checkbox'
                };
                if (roleTypeMap[role]) {
                    return roleTypeMap[role];
                }
            }
            
            // Check for iframe (WYSIWYG editors often use iframes)
            if (tagName === 'iframe') {
                return 'richtext';
            }
            
            return 'unknown';
        } catch (error) {
            return 'unknown';
        }
    }

    /**
     * Get field metadata
     * @param {Object} locator - Playwright locator
     * @returns {Promise<Object>} Field metadata
     */
    static async getMetadata(locator) {
        try {
            const type = await this.detectType(locator);
            const name = await locator.getAttribute('name');
            const id = await locator.getAttribute('id');
            const placeholder = await locator.getAttribute('placeholder');
            const autocomplete = await locator.getAttribute('autocomplete');
            const title = await locator.getAttribute('title');
            const label = await this._getLabel(locator);
            
            // Get ARIA attributes
            const ariaLabel = await locator.getAttribute('aria-label');
            const ariaLabelledBy = await locator.getAttribute('aria-labelledby');
            const ariaDescribedBy = await locator.getAttribute('aria-describedby');
            const ariaRequired = await locator.getAttribute('aria-required');
            const ariaInvalid = await locator.getAttribute('aria-invalid');
            const ariaDisabled = await locator.getAttribute('aria-disabled');
            const ariaReadonly = await locator.getAttribute('aria-readonly');
            const ariaChecked = await locator.getAttribute('aria-checked');
            const ariaSelected = await locator.getAttribute('aria-selected');
            const ariaExpanded = await locator.getAttribute('aria-expanded');
            const ariaValueMin = await locator.getAttribute('aria-valuemin');
            const ariaValueMax = await locator.getAttribute('aria-valuemax');
            const ariaValueNow = await locator.getAttribute('aria-valuenow');
            const ariaValueText = await locator.getAttribute('aria-valuetext');
            const ariaAutocomplete = await locator.getAttribute('aria-autocomplete');
            const ariaHasPopup = await locator.getAttribute('aria-haspopup');
            const ariaMultiSelectable = await locator.getAttribute('aria-multiselectable');
            const ariaMultiline = await locator.getAttribute('aria-multiline');
            const role = await locator.getAttribute('role');
            
            // Get data attributes
            const dataFieldType = await locator.getAttribute('data-field-type');
            const dataType = await locator.getAttribute('data-type');
            
            // Get validation attributes
            const required = await locator.getAttribute('required');
            const pattern = await locator.getAttribute('pattern');
            const min = await locator.getAttribute('min');
            const max = await locator.getAttribute('max');
            const minLength = await locator.getAttribute('minlength');
            const maxLength = await locator.getAttribute('maxlength');
            const step = await locator.getAttribute('step');
            
            // Get state attributes
            const disabled = await locator.getAttribute('disabled');
            const readonly = await locator.getAttribute('readonly');
            const checked = await locator.getAttribute('checked');
            const value = await locator.getAttribute('value');
            
            return {
                type,
                name,
                id,
                placeholder,
                title,
                autocomplete,
                label,
                // ARIA
                ariaLabel,
                ariaLabelledBy,
                ariaDescribedBy,
                ariaRequired: ariaRequired === 'true',
                ariaInvalid: ariaInvalid === 'true',
                ariaDisabled: ariaDisabled === 'true',
                ariaReadonly: ariaReadonly === 'true',
                ariaChecked,
                ariaSelected: ariaSelected === 'true',
                ariaExpanded: ariaExpanded === 'true',
                ariaValueMin,
                ariaValueMax,
                ariaValueNow,
                ariaValueText,
                ariaAutocomplete,
                ariaHasPopup,
                ariaMultiSelectable: ariaMultiSelectable === 'true',
                ariaMultiline: ariaMultiline === 'true',
                role,
                // Data attributes
                dataFieldType,
                dataType,
                // Validation
                required: required !== null,
                pattern,
                min,
                max,
                minLength,
                maxLength,
                step,
                // State
                disabled: disabled !== null,
                readonly: readonly !== null,
                checked: checked !== null,
                value
            };
        } catch (error) {
            return { type: 'unknown' };
        }
    }

    /**
     * Get associated label for field
     * @param {Object} locator - Playwright locator
     * @returns {Promise<string>} Label text
     */
    static async _getLabel(locator) {
        try {
            // Priority 1: aria-label (most direct)
            const ariaLabel = await locator.getAttribute('aria-label');
            if (ariaLabel) {
                return ariaLabel;
            }
            
            // Priority 2: aria-labelledby (reference to another element)
            const ariaLabelledBy = await locator.getAttribute('aria-labelledby');
            if (ariaLabelledBy) {
                try {
                    const labelElement = locator.page().locator(`#${ariaLabelledBy}`).first();
                    if (await labelElement.count() > 0) {
                        const labelText = await labelElement.textContent();
                        if (labelText) return labelText.trim();
                    }
                } catch (error) {
                    // Continue to next strategy
                }
            }
            
            // Priority 3: label[for] attribute
            const id = await locator.getAttribute('id');
            if (id) {
                const label = await locator.page().locator(`label[for="${id}"]`).first();
                if (await label.count() > 0) {
                    const labelText = await label.textContent();
                    if (labelText) return labelText.trim();
                }
            }
            
            // Priority 4: parent label element
            const parentLabel = await locator.locator('xpath=ancestor::label').first();
            if (await parentLabel.count() > 0) {
                const labelText = await parentLabel.textContent();
                if (labelText) return labelText.trim();
            }
            
            // Priority 5: preceding sibling label
            const precedingLabel = await locator.locator('xpath=preceding-sibling::label[1]').first();
            if (await precedingLabel.count() > 0) {
                const labelText = await precedingLabel.textContent();
                if (labelText) return labelText.trim();
            }
            
            // Priority 6: placeholder (as fallback)
            const placeholder = await locator.getAttribute('placeholder');
            if (placeholder) {
                return placeholder;
            }
            
            // Priority 7: title attribute (as fallback)
            const title = await locator.getAttribute('title');
            if (title) {
                return title;
            }
            
            return null;
        } catch (error) {
            return null;
        }
    }
}

