"""
Field Detector Module
Detects the type of form field automatically
"""

import re
from typing import Optional, Dict, Any


class FieldDetector:
    """
    Detects field type from element
    """
    
    @staticmethod
    async def detect_type(locator) -> str:
        """
        Detect field type from element
        """
        try:
            # Get tag name
            tag_name = await locator.evaluate('el => el.tagName.toLowerCase()')
            
            # Get input type
            input_type = await locator.get_attribute('type')
            
            # Check for select
            if tag_name == 'select':
                return 'select'
            
            # Check for textarea
            if tag_name == 'textarea':
                return 'textarea'
            
            # Check for dropzone (div with dropzone class)
            if tag_name == 'div':
                class_name = await locator.get_attribute('class')
                element_id = await locator.get_attribute('id')
                if class_name and ('dropzone' in class_name.lower() or 'drop-zone' in class_name.lower()):
                    return 'file'
                if element_id and ('dropzone' in element_id.lower() or 'drop-zone' in element_id.lower()):
                    return 'file'
            
            # Check input types
            if tag_name == 'input':
                # Skip hidden inputs
                if input_type in ['hidden', 'submit', 'button']:
                    return 'hidden'
                
                if input_type == 'file':
                    return 'file'
                if input_type in ['date', 'datetime-local']:
                    return 'date'
                if input_type == 'time':
                    return 'time'
                if input_type == 'email':
                    return 'email'
                if input_type == 'tel':
                    return 'tel'
                if input_type == 'url':
                    return 'url'
                if input_type == 'radio':
                    return 'radio'
                if input_type == 'checkbox':
                    return 'checkbox'
                if input_type == 'number':
                    return 'number'
                if input_type == 'password':
                    return 'password'
                if input_type == 'range':
                    return 'range'
                
                # Check for custom components by role or data attributes
                role = await locator.get_attribute('role')
                class_name = await locator.get_attribute('class')
                content_editable = await locator.get_attribute('contenteditable')
                data_field_type = await locator.get_attribute('data-field-type')
                data_placeholder = await locator.get_attribute('data-placeholder')
                aria_autocomplete = await locator.get_attribute('aria-autocomplete')
                
                # Check for custom select box: input text with data-placeholder and hidden select nearby
                if input_type == 'text' and data_placeholder:
                    # Check if there's a hidden select element in the same container
                    has_hidden_select = await locator.evaluate("""
                        (input) => {
                            const container = input.closest('div');
                            if (container) {
                                const select = container.querySelector('select.form--hidden, select[class*="hidden"], select[style*="display: none"], select[style*="display:none"]');
                                if (select) {
                                    return true;
                                }
                            }
                            return false;
                        }
                    """)
                    if has_hidden_select:
                        return 'select'
                
                # Check data-field-type attribute
                if data_field_type:
                    field_type_map = {
                        'email': 'email',
                        'tel': 'tel',
                        'url': 'url',
                        'number': 'number',
                        'date': 'date',
                        'text': 'text',
                        'password': 'password'
                    }
                    if data_field_type in field_type_map:
                        return field_type_map[data_field_type]
                
                # Check for WYSIWYG editors
                if content_editable == 'true' or (class_name and ('ql-editor' in class_name or 'mce-content-body' in class_name)):
                    return 'richtext'
                
                # Check for combobox with hidden select or bw-popover (should be treated as select, not autocomplete)
                if role == 'combobox':
                    # Check if there's a hidden select element nearby (this is a custom select, not autocomplete)
                    has_hidden_select = await locator.evaluate("""
                        (button) => {
                            const container = button.closest('div');
                            if (container) {
                                const select = container.querySelector('select[aria-hidden="true"], select[style*="position: absolute"], select[style*="position:absolute"], select[style*="clip: rect"]');
                                if (select) {
                                    return true;
                                }
                            }
                            return false;
                        }
                    """)
                    if has_hidden_select:
                        return 'select'  # This is a custom select combobox, not autocomplete
                    
                    # Check for bw-popover/bw-select-menu (custom select implementation)
                    has_bw_select = await locator.evaluate("""
                        (button) => {
                            // Check if there's a bw-popover or bw-select-menu in the document
                            const popover = document.querySelector('bw-popover, bw-select-menu');
                            if (popover) {
                                return true;
                            }
                            // Also check if button has data attributes that suggest it opens a popover
                            if (button.getAttribute('aria-controls') || button.getAttribute('aria-haspopup')) {
                                return true;
                            }
                            return false;
                        }
                    """)
                    if has_bw_select:
                        return 'select'  # This is a custom select with popover, not autocomplete
                
                # Check for autocomplete/typeahead (only if not a select)
                if role in ['combobox', 'searchbox'] or \
                   aria_autocomplete in ['list', 'both'] or \
                   (class_name and ('autocomplete' in class_name or 'typeahead' in class_name or 'selectize' in class_name)):
                    return 'autocomplete'
                
                # Check for textbox role (contenteditable)
                if role == 'textbox' and content_editable == 'true':
                    return 'richtext'
                
                # Check for spinbutton role
                if role == 'spinbutton':
                    return 'number'
                
                # Check for slider role
                if role == 'slider':
                    return 'range'
                
                # Check for switch role
                if role == 'switch':
                    return 'checkbox'
                
                # Check for datepicker by class
                if class_name and any(x in class_name for x in ['datepicker', 'date-picker', 'calendar', 'flatpickr', 'air-datepicker', 'react-datepicker']):
                    return 'date'
                
                # Check for toggle switch
                if class_name and ('toggle' in class_name or 'switch' in class_name):
                    return 'checkbox'
                
                # Default to text
                return 'text'
            
            # Check for contentEditable divs
            if tag_name == 'div':
                content_editable = await locator.get_attribute('contenteditable')
                class_name = await locator.get_attribute('class')
                role = await locator.get_attribute('role')
                
                if role == 'textbox' and content_editable == 'true':
                    return 'richtext'
                if role in ['combobox', 'listbox']:
                    return 'select'
                if role == 'slider':
                    return 'range'
                
                if content_editable == 'true' or (class_name and any(x in class_name for x in ['ql-editor', 'mce-content-body', 'ck-content'])):
                    return 'richtext'
                
                # Check for custom select components
                if class_name and any(x in class_name for x in ['tagify', 'multiselect', 'selectize']):
                    return 'select'
            
            # Check for elements with role attributes
            role = await locator.get_attribute('role')
            if role:
                role_type_map = {
                    'textbox': 'text',
                    'combobox': 'autocomplete',
                    'listbox': 'select',
                    'searchbox': 'autocomplete',
                    'spinbutton': 'number',
                    'slider': 'range',
                    'checkbox': 'checkbox',
                    'radio': 'radio',
                    'switch': 'checkbox'
                }
                if role in role_type_map:
                    return role_type_map[role]
            
            # Check for iframe
            if tag_name == 'iframe':
                return 'richtext'
            
            return 'unknown'
        except Exception:
            return 'unknown'
    
    @staticmethod
    async def get_label(locator) -> Optional[str]:
        """
        Get associated label for field
        """
        try:
            # Priority 1: aria-label
            aria_label = await locator.get_attribute('aria-label')
            if aria_label:
                return aria_label
            
            # Priority 2: aria-labelledby
            aria_labelled_by = await locator.get_attribute('aria-labelledby')
            if aria_labelled_by:
                try:
                    label_element = locator.page.locator(f'#{aria_labelled_by}').first
                    if await label_element.count() > 0:
                        label_text = await label_element.text_content()
                        if label_text:
                            return label_text.strip()
                except Exception:
                    pass
            
            # Priority 3: label[for]
            field_id = await locator.get_attribute('id')
            if field_id:
                # Try label[for] first
                label = locator.page.locator(f'label[for="{field_id}"]').first
                if await label.count() > 0:
                    label_text = await label.text_content()
                    if label_text:
                        return label_text.strip()
                
                # Try label with id pattern (e.g., input id="2" -> label id="2-label")
                label_patterns = [
                    f'label#{field_id}-label',
                    f'label[id="{field_id}-label"]',
                    f'label[id*="{field_id}"]'
                ]
                for pattern in label_patterns:
                    try:
                        label = locator.page.locator(pattern).first
                        if await label.count() > 0:
                            label_text = await label.text_content()
                            if label_text:
                                return label_text.strip()
                    except Exception:
                        continue
            
            # Priority 4: Find label in parent container
            try:
                parent_label = await locator.evaluate("""
                    (el) => {
                        // Look for label in parent containers
                        let current = el.parentElement;
                        for (let i = 0; i < 5 && current; i++) {
                            // Check if current has a label child
                            const label = current.querySelector('label');
                            if (label && label.textContent) {
                                return label.textContent.trim();
                            }
                            // Check if current is a label
                            if (current.tagName === 'LABEL' && current.textContent) {
                                return current.textContent.trim();
                            }
                            current = current.parentElement;
                        }
                        return null;
                    }
                """)
                if parent_label:
                    return parent_label
            except Exception:
                pass
            
            # Priority 5: parent label (xpath)
            parent_label = locator.locator('xpath=ancestor::label').first
            if await parent_label.count() > 0:
                label_text = await parent_label.text_content()
                if label_text:
                    return label_text.strip()
            
            # Priority 6: preceding sibling label
            preceding_label = locator.locator('xpath=preceding-sibling::label[1]').first
            if await preceding_label.count() > 0:
                label_text = await preceding_label.text_content()
                if label_text:
                    return label_text.strip()
            
            # Priority 7: Find label by name pattern (e.g., input name="item2" -> label id="2-label")
            field_name = await locator.get_attribute('name')
            if field_name:
                # Extract number from name (e.g., "item2" -> "2")
                match = re.search(r'(\d+)', field_name)
                if match:
                    num = match.group(1)
                    label_patterns = [
                        f'label#{num}-label',
                        f'label[id="{num}-label"]',
                        f'label[id*="{num}"]'
                    ]
                    for pattern in label_patterns:
                        try:
                            label = locator.page.locator(pattern).first
                            if await label.count() > 0:
                                label_text = await label.text_content()
                                if label_text:
                                    return label_text.strip()
                        except Exception:
                            continue
            
            # Priority 8: placeholder (only if no label found)
            placeholder = await locator.get_attribute('placeholder')
            if placeholder:
                return placeholder
            
            # Priority 7: title
            title = await locator.get_attribute('title')
            if title:
                return title
            
            return None
        except Exception:
            return None

