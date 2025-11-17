"""
Select Field Filler Module
Handles dropdown/select fields with intelligent value mapping
"""

from typing import Dict, List, Optional, Any


class SelectFieldFiller:
    """
    Handles select/dropdown fields with value mappings
    """
    
    @staticmethod
    def _get_value_mappings(field_name: str, config_value: str) -> Dict[str, List[str]]:
        """
        Get value mappings for common fields
        Maps English/config values to German/actual option values and labels
        """
        lower_field_name = (field_name or '').lower()
        lower_value = (config_value or '').lower().strip()
        
        # Gender mappings
        if 'gender' in lower_field_name or 'geschlecht' in lower_field_name:
            gender_mappings = {
                'male': {'values': ['m', 'male'], 'labels': ['Männlich', 'Male', 'männlich']},
                'männlich': {'values': ['m', 'male'], 'labels': ['Männlich', 'Male', 'männlich']},
                'female': {'values': ['w', 'f', 'female'], 'labels': ['Weiblich', 'Female', 'weiblich']},
                'weiblich': {'values': ['w', 'f', 'female'], 'labels': ['Weiblich', 'Female', 'weiblich']},
                'divers': {'values': ['d', 'divers'], 'labels': ['Divers', 'divers']},
                'diverse': {'values': ['d', 'divers'], 'labels': ['Divers', 'divers']},
                'ohne angabe': {'values': ['u', 'ohne_angabe', 'keine_angabe'], 'labels': ['Ohne Angabe', 'ohne angabe', 'keine angabe']},
                'keine_angabe': {'values': ['u', 'ohne_angabe', 'keine_angabe'], 'labels': ['Ohne Angabe', 'ohne angabe', 'keine angabe']},
                'ohne_angabe': {'values': ['u', 'ohne_angabe', 'keine_angabe'], 'labels': ['Ohne Angabe', 'ohne angabe', 'keine angabe']}
            }
            
            if lower_value in gender_mappings:
                return gender_mappings[lower_value]
        
        # Country mappings
        if 'country' in lower_field_name or 'land' in lower_field_name:
            country_mappings = {
                'germany': {'values': ['de', 'germany', 'deutschland'], 'labels': ['Germany', 'Deutschland', 'germany', 'deutschland']},
                'deutschland': {'values': ['de', 'germany', 'deutschland'], 'labels': ['Germany', 'Deutschland', 'germany', 'deutschland']},
                'austria': {'values': ['at', 'austria', 'österreich'], 'labels': ['Austria', 'Österreich', 'austria', 'österreich']},
                'switzerland': {'values': ['ch', 'switzerland', 'schweiz'], 'labels': ['Switzerland', 'Schweiz', 'switzerland', 'schweiz']},
                'iran': {'values': ['ir', 'iran', 'islamic republic of iran'], 'labels': ['Iran', 'Iran (Islamic Republic of)', 'Iran, Islamic Republic of', 'iran']},
                'persia': {'values': ['ir', 'iran', 'islamic republic of iran'], 'labels': ['Iran', 'Iran (Islamic Republic of)', 'Iran, Islamic Republic of', 'iran']}
            }
            
            if lower_value in country_mappings:
                return country_mappings[lower_value]
        
        # Job experience mappings - support direct value matching
        if 'job_experience' in lower_field_name or 'professional experience' in lower_field_name or 'berufserfahrung' in lower_field_name:
            # If value is already a number (like "5"), return it directly for exact match
            try:
                num_value = str(int(config_value))
                if config_value and config_value != '':
                    return {'values': [num_value], 'labels': []}
            except:
                pass
            
            experience_mappings = {
                'beginners': {'values': ['0'], 'labels': ['Einsteiger', 'Beginners', 'beginners']},
                'einsteiger': {'values': ['0'], 'labels': ['Einsteiger', 'Beginners', 'beginners']},
                '1 year': {'values': ['1'], 'labels': ['bis 1 Jahr', 'up to 1 year']},
                'bis 1 jahr': {'values': ['1'], 'labels': ['bis 1 Jahr', 'up to 1 year']},
                '2 years': {'values': ['2'], 'labels': ['bis 2 Jahre', 'up to 2 years']},
                'bis 2 jahre': {'values': ['2'], 'labels': ['bis 2 Jahre', 'up to 2 years']},
                '5 years': {'values': ['5'], 'labels': ['bis 5 Jahre', 'up to 5 years']},
                'bis 5 jahre': {'values': ['5'], 'labels': ['bis 5 Jahre', 'up to 5 years']},
                '10 years': {'values': ['10'], 'labels': ['bis 10 Jahre', 'up to 10 years']},
                'bis 10 jahre': {'values': ['10'], 'labels': ['bis 10 Jahre', 'up to 10 years']},
                '15 years': {'values': ['15'], 'labels': ['bis 15 Jahre oder mehr', 'up to 15 years or more']},
                'bis 15 jahre oder mehr': {'values': ['15'], 'labels': ['bis 15 Jahre oder mehr', 'up to 15 years or more']},
                '15+': {'values': ['15'], 'labels': ['bis 15 Jahre oder mehr', 'up to 15 years or more']}
            }
            
            if lower_value in experience_mappings:
                return experience_mappings[lower_value]
        
        # Career level mappings - support direct value matching
        if 'career_levels' in lower_field_name or 'karrierestufe' in lower_field_name or 'career level' in lower_field_name:
            # If value is already a number or string, return it directly for exact match
            if config_value and config_value != '':
                return {'values': [str(config_value)], 'labels': []}
        
        # Graduation (Highest degree) mappings
        if 'graduation' in lower_field_name or 'highest degree' in lower_field_name or 'höchster abschluss' in lower_field_name:
            graduation_mappings = {
                'hauptschulabschluss': {'values': ['Hauptschulabschluss'], 'labels': ['Secondary school leaving certificate / lower secondary school', 'Hauptschulabschluss']},
                'realschulabschluss': {'values': ['Realschulabschluss'], 'labels': ['Secondary school leaving certificate / vocational baccalaureate', 'Realschulabschluss']},
                'abitur': {'values': ['Abitur / Matura'], 'labels': ['Abitur / Matura', 'Abitur', 'Matura']},
                'matura': {'values': ['Abitur / Matura'], 'labels': ['Abitur / Matura', 'Abitur', 'Matura']},
                'hochschule / uni / fh /etc.': {'values': ['Hochschule / Uni / FH /etc.'], 'labels': ['College / University / University of Applied Sciences / etc.', 'Hochschule / Uni / FH /etc.', 'University', 'College']},
                'university': {'values': ['Hochschule / Uni / FH /etc.'], 'labels': ['College / University / University of Applied Sciences / etc.', 'Hochschule / Uni / FH /etc.', 'University', 'College']},
                'college': {'values': ['Hochschule / Uni / FH /etc.'], 'labels': ['College / University / University of Applied Sciences / etc.', 'Hochschule / Uni / FH /etc.', 'University', 'College']},
                'bachelor': {'values': ['Hochschule / Uni / FH /etc.'], 'labels': ['College / University / University of Applied Sciences / etc.', 'Hochschule / Uni / FH /etc.', 'University', 'College']},
                'master': {'values': ['Hochschule / Uni / FH /etc.'], 'labels': ['College / University / University of Applied Sciences / etc.', 'Hochschule / Uni / FH /etc.', 'University', 'College']}
            }
            
            if lower_value in graduation_mappings:
                return graduation_mappings[lower_value]
        
        # Language knowledge mappings (German and English)
        if 'german_knowledge' in lower_field_name or 'deutsch' in lower_field_name or 'english_knowledge' in lower_field_name or 'englisch' in lower_field_name:
            language_mappings = {
                'unknown': {'values': ['unknown'], 'labels': ['Keine Kenntnis', 'No knowledge', 'unknown']},
                'no knowledge': {'values': ['unknown'], 'labels': ['Keine Kenntnis', 'No knowledge', 'unknown']},
                'keine kenntnis': {'values': ['unknown'], 'labels': ['Keine Kenntnis', 'No knowledge', 'unknown']},
                'little_known': {'values': ['little_known'], 'labels': ['Geringe Kenntnis', 'Little knowledge', 'little_known']},
                'little knowledge': {'values': ['little_known'], 'labels': ['Geringe Kenntnis', 'Little knowledge', 'little_known']},
                'geringe kenntnis': {'values': ['little_known'], 'labels': ['Geringe Kenntnis', 'Little knowledge', 'little_known']},
                'basic': {'values': ['little_known'], 'labels': ['Geringe Kenntnis', 'Little knowledge', 'little_known']},
                'advanced': {'values': ['advanced'], 'labels': ['Fortgeschritten', 'Advanced', 'advanced']},
                'fortgeschritten': {'values': ['advanced'], 'labels': ['Fortgeschritten', 'Advanced', 'advanced']},
                'fluent': {'values': ['fluent'], 'labels': ['Verhandlungssicher', 'Fluent', 'fluent']},
                'verhandlungssicher': {'values': ['fluent'], 'labels': ['Verhandlungssicher', 'Fluent', 'fluent']},
                'native': {'values': ['fluent'], 'labels': ['Verhandlungssicher', 'Fluent', 'fluent']},
                'native speaker': {'values': ['fluent'], 'labels': ['Verhandlungssicher', 'Fluent', 'fluent']}
            }
            
            if lower_value in language_mappings:
                return language_mappings[lower_value]
        
        # Return original value as fallback
        return {'values': [config_value], 'labels': [config_value]}
    
    @staticmethod
    async def _get_available_options(locator) -> List[Dict[str, str]]:
        """
        Get all available options from a select field
        For custom select boxes, also get options from div.form__selectbox-option
        For bw-popover/bw-select-menu, get options from bw-select-option elements
        """
        try:
            # Get the element first
            element = await locator.element_handle()
            if not element:
                return []
            
            # Check if this is a custom select (input text with hidden select)
            tag_name = await locator.evaluate("el => el.tagName.toLowerCase()")
            input_type = await locator.get_attribute('type')
            data_placeholder = await locator.get_attribute('data-placeholder')
            role = await locator.get_attribute('role')
            
            # Check for bw-popover/bw-select-menu custom select
            is_bw_select = False
            if tag_name == 'button' and role == 'combobox':
                is_bw_select = await locator.page.evaluate("""
                    () => {
                        return !!document.querySelector('bw-popover, bw-select-menu');
                    }
                """)
            
            # For bw-select-menu, get options from popover
            if is_bw_select:
                print(f'   [GET_OPTIONS] Detected bw-select-menu, getting options from popover...')
                try:
                    # First, try to click button to open popover
                    await locator.click()
                    await locator.page.wait_for_timeout(500)
                    
                    # Get options from popover
                    options = await locator.page.evaluate("""
                        () => {
                            const opts = [];
                            const popover = document.querySelector('bw-popover, bw-select-menu');
                            if (popover) {
                                const selectOptions = popover.querySelectorAll('bw-select-option');
                                selectOptions.forEach((option, idx) => {
                                    const itemDiv = option.querySelector('div.item');
                                    const label = itemDiv ? itemDiv.textContent.trim() : '';
                                    // Try to get value from option attributes or index
                                    const value = option.getAttribute('value') || 
                                                 option.getAttribute('data-value') || 
                                                 String(idx);
                                    if (label) {
                                        opts.push({
                                            value: value,
                                            label: label,
                                            index: idx
                                        });
                                    }
                                });
                            }
                            return opts;
                        }
                    """)
                    
                    if options:
                        print(f'   [GET_OPTIONS] Found {len(options)} options from bw-select-menu')
                        return options
                    else:
                        # Close popover if no options found
                        await locator.page.keyboard.press('Escape')
                        await locator.page.wait_for_timeout(200)
                except Exception as e:
                    print(f'   [GET_OPTIONS] Error getting bw-select-menu options: {str(e)}')
                    # Close popover if error
                    try:
                        await locator.page.keyboard.press('Escape')
                        await locator.page.wait_for_timeout(200)
                    except Exception:
                        pass
            
            # For custom select, get options from both select and div.form__selectbox-option
            if tag_name == 'input' and input_type == 'text' and data_placeholder:
                print(f'   [GET_OPTIONS] Custom select detected, getting options from div.form__selectbox-option...')
                # Find container and get options from both select and div
                options = await locator.page.evaluate("""
                    (input) => {
                        const opts = [];
                        const container = input.closest('div');
                        if (container) {
                            // First, get options from hidden select
                            const select = container.querySelector('select.form--hidden, select[class*="hidden"], select[class*="cxsSelectField"]');
                            if (select && select.options) {
                                for (let i = 0; i < select.options.length; i++) {
                                    const option = select.options[i];
                                    if (option) {
                                        const val = option.value !== undefined && option.value !== null ? String(option.value) : '';
                                        const lbl = option.text ? option.text.trim() : '';
                                        if (val !== '' || lbl !== '') {
                                            opts.push({
                                                value: val,
                                                label: lbl,
                                                index: i
                                            });
                                        }
                                    }
                                }
                            }
                            
                            // Also get options from div.form__selectbox-option for better matching
                            const selectboxOptions = container.querySelectorAll('div.form__selectbox-option');
                            selectboxOptions.forEach((div, idx) => {
                                const label = div.textContent ? div.textContent.trim() : '';
                                const selectedIndex = div.getAttribute('data-selected-index');
                                if (label) {
                                    // Try to match with select options by index
                                    const selectOption = select && select.options ? select.options[parseInt(selectedIndex) || idx + 1] : null;
                                    const value = selectOption ? selectOption.value : '';
                                    opts.push({
                                        value: value,
                                        label: label,
                                        index: parseInt(selectedIndex) || idx + 1,
                                        fromDiv: true
                                    });
                                }
                            });
                        }
                        return opts;
                    }
                """, await locator.element_handle())
                print(f'   [GET_OPTIONS] Found {len(options)} options from custom select')
                return options if options else []
            
            # Regular select - get options from select element
            options = await element.evaluate("""
                (select) => {
                    const opts = [];
                    if (!select || !select.options) return opts;
                    for (let i = 0; i < select.options.length; i++) {
                        const option = select.options[i];
                        if (option) {
                            const val = option.value !== undefined && option.value !== null ? String(option.value) : '';
                            const lbl = option.text ? option.text.trim() : '';
                            if (val !== '' || lbl !== '') {
                                opts.push({
                                    value: val,
                                    label: lbl
                                });
                            }
                        }
                    }
                    return opts;
                }
            """)
            return options if options else []
        except Exception as e:
            # Try alternative method using page.evaluate with selector
            try:
                # Get selector from locator
                element_id = await locator.get_attribute('id')
                element_name = await locator.get_attribute('name')
                
                selector = None
                if element_id:
                    selector = f'#{element_id}'
                elif element_name:
                    selector = f'[name="{element_name}"]'
                
                if selector:
                    options = await locator.page.evaluate("""
                        (sel) => {
                            const select = document.querySelector(sel);
                            if (!select || !select.options) return [];
                            const opts = [];
                            for (let i = 0; i < select.options.length; i++) {
                                const option = select.options[i];
                                if (option) {
                                    const val = option.value !== undefined && option.value !== null ? String(option.value) : '';
                                    const lbl = option.text ? option.text.trim() : '';
                                    if (val !== '' || lbl !== '') {
                                        opts.push({ value: val, label: lbl });
                                    }
                                }
                            }
                            return opts;
                        }
                    """, selector)
                    return options if options else []
            except Exception as e2:
                print(f'   Alternative method error: {str(e2)}')
                pass
            return []
    
    @staticmethod
    async def _update_custom_select_input(page, original_input_locator, selected_label: str) -> None:
        """
        Update the visible input text field for custom select boxes after selecting a value
        """
        if original_input_locator:
            try:
                await page.evaluate("""
                    (input, label) => {
                        if (input) {
                            input.value = label;
                            // Trigger events to update the UI
                            const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                            input.dispatchEvent(inputEvent);
                            const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                            input.dispatchEvent(changeEvent);
                        }
                    }
                """, await original_input_locator.element_handle(), selected_label)
                print(f'   [CUSTOM_SELECT] Updated input text to: "{selected_label}"')
            except Exception as e:
                print(f'   [CUSTOM_SELECT] Error updating input text: {str(e)}')
    
    @staticmethod
    async def fill(page, selectors: List[str], value: str, field_name: str = '') -> bool:
        """
        Fill a select/dropdown field
        """
        print(f'[INFO] Processing select field: "{field_name}" with value: "{value}"')
        print(f'[INFO] Selectors to try: {selectors}')
        
        # Variable to store original input locator for custom select
        original_input_locator = None
        
        for selector in selectors:
            try:
                print(f'\n   [SELECTOR] Trying selector: {selector}')
                locator = page.locator(selector).first
                
                # Check if element exists
                count = await locator.count()
                print(f'   [SELECTOR] Element count: {count}')
                
                if count == 0:
                    print(f'   [SELECTOR] No elements found with selector: {selector}')
                    continue
                
                # Wait for visibility
                try:
                    await locator.wait_for(state='visible', timeout=5000)
                    print(f'   [SELECTOR] Element is visible')
                except Exception as e:
                    print(f'   [SELECTOR] Element not visible or timeout: {str(e)}')
                    # Try to continue anyway
                
                if await locator.count() > 0:
                    await locator.scroll_into_view_if_needed()
                    await page.wait_for_timeout(100)
                    
                    # Check if this is a custom select (input text with hidden select)
                    tag_name = await locator.evaluate("el => el.tagName.toLowerCase()")
                    input_type = await locator.get_attribute('type')
                    data_placeholder = await locator.get_attribute('data-placeholder')
                    role = await locator.get_attribute('role')
                    
                    # If it's an input text with data-placeholder, find the hidden select
                    if tag_name == 'input' and input_type == 'text' and data_placeholder:
                        print(f'   [CUSTOM_SELECT] Detected custom select, finding hidden select element...')
                        # Find hidden select in container
                        hidden_select = await page.evaluate("""
                            (input) => {
                                const container = input.closest('div');
                                if (container) {
                                    const select = container.querySelector('select.form--hidden, select[class*="hidden"], select[style*="display: none"], select[style*="display:none"]');
                                    if (select) {
                                        return {
                                            id: select.id || '',
                                            name: select.name || '',
                                            selector: select.id ? `select#${select.id}` : `select[name="${select.name}"]`
                                        };
                                    }
                                }
                                return null;
                            }
                        """, await locator.element_handle())
                        
                        if hidden_select:
                            print(f'   [CUSTOM_SELECT] Found hidden select: id="{hidden_select.get("id")}", name="{hidden_select.get("name")}"')
                            # Store the original input locator for later update
                            original_input_locator = locator
                            # Use the hidden select locator instead
                            locator = page.locator(hidden_select['selector']).first
                            print(f'   [CUSTOM_SELECT] Using hidden select locator: {hidden_select["selector"]}')
                        else:
                            original_input_locator = None
                    
                    # First, try to read all available options for better matching
                    available_options = []
                    try:
                        available_options = await SelectFieldFiller._get_available_options(locator)
                        if available_options:
                            print(f'   Found {len(available_options)} options in select')
                            # Log first few options for debugging
                            for opt in available_options[:5]:
                                print(f'      - value="{opt.get("value", "")}" label="{opt.get("label", "")}"')
                    except Exception as e:
                        print(f'   Could not read options: {str(e)}')
                    
                    # Get value mappings
                    mappings = SelectFieldFiller._get_value_mappings(field_name, value)
                    print(f'   Mapped values: {", ".join(mappings["values"])}')
                    if mappings["labels"]:
                        print(f'   Mapped labels: {", ".join(mappings["labels"])}')
                    
                    # Strategy 0: Try to match with available options first (smart matching)
                    if available_options:
                        value_lower = str(value).lower().strip()
                        value_str = str(value).strip()
                        print(f'   [STRATEGY 0] Looking for value="{value_str}" (lowercase: "{value_lower}") in {len(available_options)} options')
                        
                        # First, try exact value match (most reliable)
                        # IMPORTANT: Skip placeholder options (empty value)
                        matching_option = None
                        for opt in available_options:
                            opt_value = str(opt.get('value', '')).strip()
                            opt_label = opt.get('label', '')
                            
                            # Skip placeholder options (empty value)
                            if opt_value == '':
                                print(f'   [STRATEGY 0] Skipping placeholder option: value="", label="{opt_label}"')
                                continue
                            
                            opt_value_lower = opt_value.lower().strip() if opt_value else ''
                            opt_label_lower = opt_label.lower().strip() if opt_label else ''
                            
                            # Exact value match (highest priority)
                            if opt_value == value_str or opt_value_lower == value_lower:
                                matching_option = opt
                                print(f'   [STRATEGY 0] Found EXACT value match: value="{opt_value}", label="{opt_label}"')
                                break
                            
                            # Exact label match (second priority)
                            if opt_label == value_str or opt_label_lower == value_lower:
                                matching_option = opt
                                print(f'   [STRATEGY 0] Found EXACT label match: value="{opt_value}", label="{opt_label}"')
                                break
                        
                        # If exact match found, try to select it immediately
                        if matching_option:
                            opt_value = str(matching_option.get('value', '')).strip()
                            opt_label = matching_option.get('label', '')
                            opt_index = matching_option.get('index')
                            
                            # Try multiple methods to select
                            success = False
                            
                            # Check if this is a bw-select-menu (bw-popover custom select)
                            is_bw_select = False
                            if tag_name == 'button' and role == 'combobox':
                                is_bw_select = await page.evaluate("""
                                    () => {
                                        return !!document.querySelector('bw-popover, bw-select-menu');
                                    }
                                """)
                            
                            # For bw-select-menu, handle specially
                            if is_bw_select:
                                try:
                                    print(f'   [BW_SELECT_METHOD] Trying bw-select-menu with value="{opt_value}", label="{opt_label}"...')
                                    
                                    # Step 1: Click on button to open popover
                                    await locator.click()
                                    await page.wait_for_timeout(500)  # Wait for popover to open
                                    
                                    # Step 2: Find and click the option in popover
                                    option_clicked = await page.evaluate("""
                                        (targetValue, targetLabel) => {
                                            const popover = document.querySelector('bw-popover, bw-select-menu');
                                            if (popover) {
                                                const selectOptions = popover.querySelectorAll('bw-select-option');
                                                for (const option of selectOptions) {
                                                    const itemDiv = option.querySelector('div.item');
                                                    const optionLabel = itemDiv ? itemDiv.textContent.trim() : '';
                                                    
                                                    // Match by label
                                                    if (optionLabel === targetLabel || 
                                                        optionLabel.toLowerCase() === targetLabel.toLowerCase()) {
                                                        option.click();
                                                        return true;
                                                    }
                                                }
                                            }
                                            return false;
                                        }
                                    """, opt_value, opt_label)
                                    
                                    if option_clicked:
                                        await page.wait_for_timeout(500)
                                        print(f'[OK] {field_name or selector}: \'{value}\' -> \'{opt_value}\' (bw-select-menu)')
                                        return True
                                    else:
                                        # Close popover if option not found
                                        await page.keyboard.press('Escape')
                                        await page.wait_for_timeout(200)
                                except Exception as e_bw:
                                    print(f'   [BW_SELECT_METHOD] Failed: {str(e_bw)}')
                                    # Try to close popover
                                    try:
                                        await page.keyboard.press('Escape')
                                        await page.wait_for_timeout(200)
                                    except Exception:
                                        pass
                            
                            # For custom select, try clicking on div.form__selectbox-option first
                            if original_input_locator and opt_label:
                                try:
                                    print(f'   [CUSTOM_SELECT_METHOD] Trying to click on div with label="{opt_label}"...')
                                    # First, click on input to open dropdown
                                    await original_input_locator.click()
                                    await page.wait_for_timeout(300)
                                    
                                    # Find and click the div with matching label
                                    clicked = await page.evaluate("""
                                        (input, label) => {
                                            const container = input.closest('div');
                                            if (container) {
                                                const options = container.querySelectorAll('div.form__selectbox-option');
                                                for (const option of options) {
                                                    const optionLabel = option.textContent ? option.textContent.trim() : '';
                                                    if (optionLabel === label || optionLabel.toLowerCase() === label.toLowerCase()) {
                                                        option.click();
                                                        return true;
                                                    }
                                                }
                                            }
                                            return false;
                                        }
                                    """, await original_input_locator.element_handle(), opt_label)
                                    
                                    if clicked:
                                        await page.wait_for_timeout(500)
                                        # Verify selection
                                        select_value = await page.evaluate("""
                                            (input) => {
                                                const container = input.closest('div');
                                                if (container) {
                                                    const select = container.querySelector('select.form--hidden, select[class*="hidden"], select[class*="cxsSelectField"]');
                                                    if (select) {
                                                        return select.value || '';
                                                    }
                                                }
                                                return '';
                                            }
                                        """, await original_input_locator.element_handle())
                                        
                                        if select_value == opt_value or (select_value and str(select_value) == opt_value):
                                            print(f'[OK] {field_name or selector}: \'{value}\' -> \'{opt_value}\' (custom select - clicked div)')
                                            await SelectFieldFiller._update_custom_select_input(page, original_input_locator, opt_label)
                                            return True
                                        else:
                                            print(f'   [CUSTOM_SELECT_METHOD] Click succeeded but value mismatch: got="{select_value}", expected="{opt_value}"')
                                except Exception as e_custom:
                                    print(f'   [CUSTOM_SELECT_METHOD] Failed: {str(e_custom)}')
                            
                            # Method 1: select_option by value (for hidden select)
                            try:
                                print(f'   [METHOD 1] Trying select_option(value="{opt_value}")')
                                await locator.select_option(value=opt_value, timeout=5000)
                                await page.wait_for_timeout(300)
                                selected = await locator.input_value()
                                print(f'   [METHOD 1] Result: selected="{selected}", expected="{opt_value}"')
                                if selected == opt_value or (selected and str(selected) == opt_value):
                                    print(f'[OK] {field_name or selector}: \'{value}\' -> \'{opt_value}\' (exact match - select_option)')
                                    # Update custom select input if needed
                                    if original_input_locator:
                                        await SelectFieldFiller._update_custom_select_input(page, original_input_locator, opt_label)
                                    return True
                                else:
                                    print(f'   [METHOD 1] Verification failed')
                            except Exception as e1:
                                print(f'   [METHOD 1] Failed: {str(e1)}')
                            
                            # Method 2: DOM manipulation
                            if not success:
                                try:
                                    print(f'   [METHOD 2] Trying DOM manipulation with value="{opt_value}"')
                                    result = await page.evaluate("""
                                        (sel, optVal) => {
                                            const select = document.querySelector(sel);
                                            if (select) {
                                                console.log('DOM: Setting select.value to', optVal, 'type:', typeof optVal);
                                                // Try as string first
                                                select.value = String(optVal);
                                                console.log('DOM: select.value is now', select.value, 'type:', typeof select.value);
                                                
                                                // Trigger standard events
                                                const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                                                select.dispatchEvent(changeEvent);
                                                const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                                                select.dispatchEvent(inputEvent);
                                                
                                                // Angular support
                                                if (window.angular) {
                                                    try {
                                                        const elem = window.angular.element(select);
                                                        if (elem && elem.injector) {
                                                            const $rootScope = elem.injector().get('$rootScope');
                                                            if ($rootScope) {
                                                                $rootScope.$apply();
                                                            }
                                                        }
                                                    } catch (e) {
                                                        console.log('Angular digest failed:', e);
                                                    }
                                                }
                                                
                                                return select.value;
                                            }
                                            return null;
                                        }
                                    """, selector, opt_value)
                                    print(f'   [METHOD 2] DOM result: {result}')
                                    await page.wait_for_timeout(500)
                                    selected = await locator.input_value()
                                    print(f'   [METHOD 2] After DOM: selected="{selected}", expected="{opt_value}"')
                                    if selected == opt_value or (selected and str(selected) == str(opt_value)):
                                        print(f'[OK] {field_name or selector}: \'{value}\' -> \'{opt_value}\' (exact match - DOM)')
                                        # Update custom select input if needed
                                        if original_input_locator:
                                            await SelectFieldFiller._update_custom_select_input(page, original_input_locator, opt_label)
                                        return True
                                    else:
                                        print(f'   [METHOD 2] Verification failed')
                                except Exception as e2:
                                    print(f'   [METHOD 2] Failed: {str(e2)}')
                            
                            # Method 3: select_option by index
                            if not success:
                                try:
                                    option_index = available_options.index(matching_option)
                                    print(f'   [METHOD 3] Trying select_option(index={option_index})')
                                    await locator.select_option(index=option_index, timeout=5000)
                                    await page.wait_for_timeout(300)
                                    selected = await locator.input_value()
                                    print(f'   [METHOD 3] Result: selected="{selected}", expected="{opt_value}"')
                                    if selected == opt_value or (selected and str(selected) == str(opt_value)):
                                        print(f'[OK] {field_name or selector}: \'{value}\' -> \'{opt_value}\' (exact match - by index)')
                                        # Update custom select input if needed
                                        if original_input_locator:
                                            await SelectFieldFiller._update_custom_select_input(page, original_input_locator, opt_label)
                                        return True
                                    else:
                                        print(f'   [METHOD 3] Verification failed')
                                except Exception as e3:
                                    print(f'   [METHOD 3] Failed: {str(e3)}')
                        
                        # If no exact match, try mapped values and labels (skip placeholders)
                        for opt in available_options:
                            opt_value = str(opt.get('value', '')).strip()
                            opt_label = opt.get('label', '')
                            
                            # Skip placeholder options (empty value)
                            if opt_value == '':
                                continue
                            
                            opt_value_lower = opt_value.lower().strip() if opt_value else ''
                            opt_label_lower = opt_label.lower().strip() if opt_label else ''
                            
                            # Check mapped values
                            for mapped_value in mappings['values']:
                                mapped_lower = mapped_value.lower().strip()
                                if opt_value_lower == mapped_lower or opt_label_lower == mapped_lower:
                                    try:
                                        print(f'   Trying to select option with value="{opt_value}" (mapped from "{mapped_value}")')
                                        await locator.select_option(value=opt_value, timeout=5000)
                                        await page.wait_for_timeout(200)
                                        selected = await locator.input_value()
                                        if selected == opt_value or (selected and opt_value and str(selected) == opt_value):
                                            print(f'[OK] {field_name or selector}: \'{value}\' -> \'{opt_value}\' (smart match)')
                                            # Update custom select input if needed
                                            if original_input_locator:
                                                await SelectFieldFiller._update_custom_select_input(page, original_input_locator, opt_label)
                                            return True
                                    except Exception as e:
                                        print(f'   Error selecting option: {str(e)}')
                                        pass
                            
                            # Check mapped labels
                            for mapped_label in mappings['labels']:
                                mapped_lower = mapped_label.lower().strip()
                                if mapped_lower in opt_label_lower or opt_label_lower in mapped_lower:
                                    try:
                                        print(f'   Trying to select option with value="{opt_value}" (label match: "{mapped_label}")')
                                        await locator.select_option(value=opt_value, timeout=5000)
                                        await page.wait_for_timeout(200)
                                        selected = await locator.input_value()
                                        if selected == opt_value or (selected and opt_value and str(selected) == opt_value):
                                            print(f'[OK] {field_name or selector}: \'{value}\' -> \'{opt_value}\' (smart label match)')
                                            # Update custom select input if needed
                                            if original_input_locator:
                                                await SelectFieldFiller._update_custom_select_input(page, original_input_locator, opt_label)
                                            return True
                                    except Exception as e:
                                        print(f'   Error selecting option: {str(e)}')
                                        pass
                            
                            # Check original value directly (exact match first)
                            if value_lower == opt_value_lower or value_lower == opt_label_lower:
                                try:
                                    print(f'   [EXACT MATCH] Found option: value="{opt_value}", label="{opt_label}"')
                                    print(f'   [EXACT MATCH] Trying to select with value="{opt_value}" (input value="{value}")')
                                    
                                    # Method 1: Try select_option first
                                    try:
                                        print(f'   [METHOD 1] Trying select_option(value="{opt_value}")')
                                        await locator.select_option(value=opt_value, timeout=5000)
                                        await page.wait_for_timeout(300)
                                        selected = await locator.input_value()
                                        print(f'   [METHOD 1] After select_option: selected="{selected}", expected="{opt_value}"')
                                        if selected == opt_value or (selected and opt_value and str(selected) == str(opt_value)):
                                            print(f'[OK] {field_name or selector}: \'{value}\' -> \'{opt_value}\' (exact match - select_option)')
                                            return True
                                        else:
                                            print(f'   [METHOD 1] Verification failed: selected="{selected}" (type: {type(selected)}), expected="{opt_value}" (type: {type(opt_value)})')
                                    except Exception as e1:
                                        print(f'   [METHOD 1] select_option failed: {str(e1)}')
                                        
                                        # Method 2: Try by index
                                        try:
                                            option_index = available_options.index(opt)
                                            print(f'   [METHOD 2] Trying select_option(index={option_index})')
                                            await locator.select_option(index=option_index, timeout=5000)
                                            await page.wait_for_timeout(300)
                                            selected = await locator.input_value()
                                            print(f'   [METHOD 2] After select_option by index: selected="{selected}", expected="{opt_value}"')
                                            if selected == opt_value or (selected and opt_value and str(selected) == str(opt_value)):
                                                print(f'[OK] {field_name or selector}: \'{value}\' -> \'{opt_value}\' (exact match - by index)')
                                                return True
                                            else:
                                                print(f'   [METHOD 2] Verification failed: selected="{selected}", expected="{opt_value}"')
                                        except Exception as e2:
                                            print(f'   [METHOD 2] select_option by index failed: {str(e2)}')
                                            
                                            # Method 3: Try DOM manipulation (including Angular support)
                                            try:
                                                print(f'   [METHOD 3] Trying DOM manipulation with value="{opt_value}"')
                                                result = await page.evaluate("""
                                                    (sel, optVal) => {
                                                        const select = document.querySelector(sel);
                                                        if (select) {
                                                            console.log('DOM: Setting select.value to', optVal);
                                                            select.value = optVal;
                                                            console.log('DOM: select.value is now', select.value);
                                                            
                                                            // Trigger standard events
                                                            const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                                                            select.dispatchEvent(changeEvent);
                                                            const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                                                            select.dispatchEvent(inputEvent);
                                                            
                                                            // Angular support: trigger ngModel change
                                                            if (window.angular && select.attributes['ng-model']) {
                                                                try {
                                                                    const scope = window.angular.element(select).scope();
                                                                    if (scope) {
                                                                        scope.$apply(function() {
                                                                            scope[select.attributes['ng-model'].value] = optVal;
                                                                        });
                                                                    }
                                                                } catch (e) {
                                                                    console.log('Angular scope update failed:', e);
                                                                }
                                                            }
                                                            
                                                            // Try to trigger Angular digest if available
                                                            if (window.angular) {
                                                                try {
                                                                    const elem = window.angular.element(select);
                                                                    if (elem && elem.injector) {
                                                                        const $rootScope = elem.injector().get('$rootScope');
                                                                        if ($rootScope) {
                                                                            $rootScope.$apply();
                                                                        }
                                                                    }
                                                                } catch (e) {
                                                                    console.log('Angular digest failed:', e);
                                                                }
                                                            }
                                                            
                                                            return select.value;
                                                        }
                                                        return null;
                                                    }
                                                """, {'sel': selector, 'optVal': opt_value})
                                                print(f'   [METHOD 3] DOM manipulation result: {result}')
                                                await page.wait_for_timeout(500)  # Give Angular time to process
                                                selected = await locator.input_value()
                                                print(f'   [METHOD 3] After DOM manipulation: selected="{selected}", expected="{opt_value}"')
                                                if selected == opt_value or (selected and opt_value and str(selected) == str(opt_value)):
                                                    print(f'[OK] {field_name or selector}: \'{value}\' -> \'{opt_value}\' (exact match - DOM)')
                                                    return True
                                                else:
                                                    print(f'   [METHOD 3] Verification failed: selected="{selected}", expected="{opt_value}"')
                                            except Exception as e3:
                                                print(f'   [METHOD 3] DOM manipulation failed: {str(e3)}')
                                    
                                    # If all methods failed, log current state
                                    current_value = await locator.input_value()
                                    print(f'   [FINAL STATE] Current select value: "{current_value}"')
                                    print(f'   [FINAL STATE] Expected value: "{opt_value}"')
                                    
                                except Exception as e:
                                    print(f'   [ERROR] Error in exact match logic: {str(e)}')
                                    import traceback
                                    print(f'   [ERROR] Traceback: {traceback.format_exc()}')
                                    pass
                            
                            # Check partial match (skip placeholders)
                            if opt_value != '' and (value_lower in opt_label_lower or opt_label_lower in value_lower):
                                try:
                                    print(f'   Trying to select option with value="{opt_value}" (partial match: "{value}" in "{opt_label}")')
                                    await locator.select_option(value=opt_value, timeout=5000)
                                    await page.wait_for_timeout(300)
                                    selected = await locator.input_value()
                                    if selected == opt_value or (selected and opt_value and str(selected) == str(opt_value)):
                                        print(f'[OK] {field_name or selector}: \'{value}\' -> \'{opt_value}\' (partial match)')
                                        return True
                                except Exception as e:
                                    print(f'   Error selecting option: {str(e)}')
                                    pass
                    
                    # Strategy 1: Try direct DOM manipulation with mapped values FIRST
                    for mapped_value in mappings['values']:
                        print(f'   Trying DOM manipulation with value: "{mapped_value}"')
                        try:
                            success = await page.evaluate("""
                                ({ sel, optionValue }) => {
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
                                }
                            """, {'sel': selector, 'optionValue': mapped_value})
                            
                            if success:
                                await page.wait_for_timeout(200)
                                # Verify
                                selected = await locator.input_value()
                                if selected == mapped_value or selected.lower() == mapped_value.lower():
                                    print(f'[OK] {field_name or selector}: \'{value}\' -> \'{mapped_value}\' (direct DOM)')
                                    return True
                        except Exception as e:
                            print(f'   DOM manipulation error: {str(e)}')
                            pass
                    
                    # Strategy 2: Try select_option with mapped values
                    for mapped_value in mappings['values']:
                        try:
                            await locator.select_option(value=mapped_value, timeout=5000)
                            selected_value = await locator.input_value()
                            if selected_value == mapped_value or selected_value.lower() == mapped_value.lower():
                                print(f'[OK] {field_name or selector}: \'{value}\' -> \'{mapped_value}\' (selectOption)')
                                return True
                        except Exception:
                            # Continue to next value
                            pass
                    
                    # Strategy 3: Try by label
                    for mapped_label in mappings['labels']:
                        try:
                            await locator.select_option(label=mapped_label, timeout=5000)
                            selected_value = await locator.input_value()
                            if selected_value:
                                print(f'[OK] {field_name or selector}: \'{value}\' -> \'{mapped_label}\' (by label)')
                                return True
                        except Exception:
                            # Continue
                            pass
                    
                    # Strategy 4: Try original value directly with multiple methods
                    value_str = str(value).strip()
                    try:
                        # Method 1: Try select_option with value
                        try:
                            await locator.select_option(value=value_str, timeout=5000)
                            await page.wait_for_timeout(300)
                            selected_value = await locator.input_value()
                            if selected_value == value_str or (selected_value and str(selected_value) == value_str):
                                print(f'[OK] {field_name or selector}: \'{value}\' (select_option by value)')
                                return True
                        except Exception as e1:
                            print(f'   select_option by value failed: {str(e1)}')
                            
                            # Method 2: Try by index if value is a number
                            try:
                                if value_str.isdigit():
                                    index = int(value_str)
                                    # Find option index in available_options
                                    for idx, opt in enumerate(available_options):
                                        if opt.get('value') == value_str:
                                            await locator.select_option(index=idx, timeout=5000)
                                            await page.wait_for_timeout(300)
                                            selected_value = await locator.input_value()
                                            if selected_value == value_str or (selected_value and str(selected_value) == value_str):
                                                print(f'[OK] {field_name or selector}: \'{value}\' (select_option by index)')
                                                return True
                            except Exception as e2:
                                print(f'   select_option by index failed: {str(e2)}')
                            
                            # Method 3: Try DOM manipulation
                            try:
                                success = await page.evaluate("""
                                    ({ sel, optionValue }) => {
                                        const select = document.querySelector(sel);
                                        if (select) {
                                            // Find option with this value (exact match first)
                                            for (let i = 0; i < select.options.length; i++) {
                                                if (select.options[i].value === optionValue || String(select.options[i].value) === String(optionValue)) {
                                                    select.value = select.options[i].value;
                                                    const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                                                    select.dispatchEvent(changeEvent);
                                                    const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                                                    select.dispatchEvent(inputEvent);
                                                    return select.value === select.options[i].value || String(select.value) === String(optionValue);
                                                }
                                            }
                                            // Try case-insensitive match
                                            const optionValueLower = String(optionValue).toLowerCase();
                                            for (let i = 0; i < select.options.length; i++) {
                                                if (String(select.options[i].value).toLowerCase() === optionValueLower) {
                                                    select.value = select.options[i].value;
                                                    const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                                                    select.dispatchEvent(changeEvent);
                                                    const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                                                    select.dispatchEvent(inputEvent);
                                                    return true;
                                                }
                                            }
                                        }
                                        return false;
                                    }
                                """, {'sel': selector, 'optionValue': value_str})
                                
                                if success:
                                    await page.wait_for_timeout(300)
                                    selected_value = await locator.input_value()
                                    if selected_value == value_str or (selected_value and str(selected_value) == value_str):
                                        print(f'[OK] {field_name or selector}: \'{value}\' (DOM manipulation)')
                                        return True
                            except Exception as e3:
                                print(f'   DOM manipulation failed: {str(e3)}')
                            
                            # Method 4: Try by label
                            try:
                                await locator.select_option(label=value_str, timeout=5000)
                                await page.wait_for_timeout(300)
                                selected_value = await locator.input_value()
                                if selected_value:
                                    print(f'[OK] {field_name or selector}: \'{value}\' (by label)')
                                    return True
                            except Exception as e4:
                                print(f'   select_option by label failed: {str(e4)}')
                    except Exception as e:
                        print(f'   All methods failed: {str(e)}')
                        pass
            except Exception:
                continue
        
        print(f'[ERROR] Failed to fill select field: "{field_name}"')
        return False

