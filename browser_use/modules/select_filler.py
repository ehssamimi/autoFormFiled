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
        """
        try:
            # Get the element first
            element = await locator.element_handle()
            if not element:
                return []
            
            # Try to get options from the element
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
    async def fill(page, selectors: List[str], value: str, field_name: str = '') -> bool:
        """
        Fill a select/dropdown field
        """
        print(f'[INFO] Processing select field: "{field_name}" with value: "{value}"')
        
        for selector in selectors:
            try:
                print(f'   Trying selector: {selector}')
                locator = page.locator(selector).first
                await locator.wait_for(state='visible', timeout=5000)
                
                if await locator.count() > 0:
                    await locator.scroll_into_view_if_needed()
                    await page.wait_for_timeout(100)
                    
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
                        for opt in available_options:
                            opt_value = opt.get('value', '').lower()
                            opt_label = opt.get('label', '').lower()
                            
                            # Check mapped values
                            for mapped_value in mappings['values']:
                                if opt_value == mapped_value.lower() or opt_label == mapped_value.lower():
                                    try:
                                        await locator.select_option(value=opt.get('value'), timeout=5000)
                                        selected = await locator.input_value()
                                        if selected == opt.get('value'):
                                            print(f'[OK] {field_name or selector}: \'{value}\' -> \'{opt.get("value")}\' (smart match)')
                                            return True
                                    except Exception:
                                        pass
                            
                            # Check mapped labels
                            for mapped_label in mappings['labels']:
                                if mapped_label.lower() in opt_label or opt_label in mapped_label.lower():
                                    try:
                                        await locator.select_option(value=opt.get('value'), timeout=5000)
                                        selected = await locator.input_value()
                                        if selected == opt.get('value'):
                                            print(f'[OK] {field_name or selector}: \'{value}\' -> \'{opt.get("value")}\' (smart label match)')
                                            return True
                                    except Exception:
                                        pass
                            
                            # Check original value
                            if value.lower() == opt_value or value.lower() == opt_label or value.lower() in opt_label:
                                try:
                                    await locator.select_option(value=opt.get('value'), timeout=5000)
                                    selected = await locator.input_value()
                                    if selected == opt.get('value'):
                                        print(f'[OK] {field_name or selector}: \'{value}\' -> \'{opt.get("value")}\' (direct match)')
                                        return True
                                except Exception:
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
                    
                    # Strategy 4: Try original value directly
                    try:
                        success = await page.evaluate("""
                            ({ sel, optionValue }) => {
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
                            }
                        """, {'sel': selector, 'optionValue': value})
                        
                        if success:
                            await page.wait_for_timeout(200)
                            print(f'[OK] {field_name or selector}: \'{value}\' (direct DOM)')
                            return True
                    except Exception:
                        # Continue
                        pass
                    
                    # Try selectOption with original value
                    try:
                        await locator.select_option(value=value, timeout=5000)
                        selected_value = await locator.input_value()
                        if selected_value == value or selected_value.lower() == value.lower():
                            print(f'[OK] {field_name or selector}: \'{value}\' (direct)')
                            return True
                    except Exception:
                        # Try by label
                        try:
                            await locator.select_option(label=value, timeout=5000)
                            selected_value = await locator.input_value()
                            if selected_value:
                                print(f'[OK] {field_name or selector}: \'{value}\' (by label direct)')
                                return True
                        except Exception:
                            # Continue
                            pass
            except Exception:
                continue
        
        print(f'[ERROR] Failed to fill select field: "{field_name}"')
        return False

