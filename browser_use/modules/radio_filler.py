"""
Radio Button Filler Module
Handles radio button groups
"""


class RadioFieldFiller:
    """
    Handles radio button selection
    """
    
    @staticmethod
    async def fill(page, name_selector: str, value: str, field_name: str = '', field_label: str = '', locator=None) -> bool:
        """
        Select a radio button
        If locator is provided, use it to find the correct radio group by context
        """
        print(f'[DEBUG] RadioFiller.fill called: name_selector="{name_selector}", value="{value}", field_name="{field_name}", field_label="{field_label}"')
        
        # If we have the original locator, use it to find the correct radio group
        if locator:
            try:
                # Get the name from the locator
                name = await locator.get_attribute('name')
                if name:
                    # Find the parent container that contains this radio group
                    # This helps us identify which question/group this radio belongs to
                    container_info = await locator.evaluate("""
                        (radio) => {
                            // Find a parent container that likely contains the question label
                            let current = radio;
                            let container = null;
                            for (let i = 0; i < 6 && current; i++) {
                                current = current.parentElement;
                                if (current) {
                                    const tagName = current.tagName;
                                    if (['DIV', 'FIELDSET', 'LI', 'TD', 'TR', 'P'].includes(tagName)) {
                                        const hasLabel = current.querySelector('label') || 
                                                       (current.textContent && current.textContent.trim().length > 10);
                                        if (hasLabel) {
                                            container = current;
                                            break;
                                        }
                                    }
                                }
                            }
                            return container ? container.outerHTML.substring(0, 200) : null;
                        }
                    """)
                    
                    # Find all radios with this name
                    all_radios = await page.locator(f'input[type="radio"][name="{name}"]').all()
                    print(f'[DEBUG] Found {len(all_radios)} radios with name="{name}"')
                    
                    # Try to find the radio that matches the value and is in the same container
                    for idx, radio in enumerate(all_radios):
                        try:
                            # Check if this radio is in the same container as the original locator
                            radio_container = await radio.evaluate("""
                                (radio) => {
                                    let current = radio;
                                    for (let i = 0; i < 6 && current; i++) {
                                        current = current.parentElement;
                                        if (current) {
                                            const tagName = current.tagName;
                                            if (['DIV', 'FIELDSET', 'LI', 'TD', 'TR', 'P'].includes(tagName)) {
                                                const hasLabel = current.querySelector('label') || 
                                                               (current.textContent && current.textContent.trim().length > 10);
                                                if (hasLabel) {
                                                    return current.outerHTML.substring(0, 200);
                                                }
                                            }
                                        }
                                    }
                                    return null;
                                }
                            """)
                            
                            # If containers match (or both are null), check if value matches
                            containers_match = container_info == radio_container or (not container_info and not radio_container)
                            if containers_match:
                                print(f'[DEBUG] Container match for radio #{idx}')
                                radio_value = await radio.get_attribute('value')
                                radio_id = await radio.get_attribute('id')
                                
                                # Get label text more thoroughly
                                radio_label_text = await radio.evaluate("""
                                    (radio) => {
                                        // Try by id first
                                        if (radio.id) {
                                            const label = document.querySelector(`label[for="${radio.id}"]`);
                                            if (label) return label.textContent.trim();
                                        }
                                        // Check parent label
                                        let current = radio.parentElement;
                                        for (let i = 0; i < 5 && current; i++) {
                                            if (current.tagName === 'LABEL') {
                                                return current.textContent.trim();
                                            }
                                            // Check for label sibling
                                            const siblingLabel = current.querySelector('label');
                                            if (siblingLabel) {
                                                return siblingLabel.textContent.trim();
                                            }
                                            current = current.parentElement;
                                        }
                                        // Check next sibling
                                        let nextSibling = radio.nextElementSibling;
                                        if (nextSibling && nextSibling.tagName === 'LABEL') {
                                            return nextSibling.textContent.trim();
                                        }
                                        return null;
                                    }
                                """)
                                
                                # Check if value or label matches (exact match first, then case-insensitive, then partial)
                                value_lower = value.lower().strip()
                                value_original = value.strip()
                                matches = False
                                
                                # First, try to map common values to German options
                                # German level mappings
                                if 'sprachlevel' in field_label.lower() or 'deutsch' in field_label.lower():
                                    german_mappings = {
                                        'fluent': ['oberstufe', 'c1', 'c2', 'muttersprachlich', 'muttersprachliches niveau'],
                                        'oberstufe__c1_c2__dsh_1___tdn_4__': ['oberstufe', 'c1', 'c2', 'dsh', 'tdn'],
                                        'oberstufe': ['oberstufe', 'c1', 'c2'],
                                        'c1': ['c1', 'oberstufe'],
                                        'c2': ['c2', 'oberstufe'],
                                        'muttersprachlich': ['muttersprachlich', 'muttersprachliches'],
                                        'intermediate': ['mittelstufe', 'b1', 'b2'],
                                        'beginner': ['unterstufe', 'a1', 'a2', 'ich spreche kein deutsch']
                                    }
                                    
                                    value_lower_mapped = value_lower
                                    for key, mapped_values in german_mappings.items():
                                        if key in value_lower:
                                            value_lower_mapped = mapped_values[0]  # Use first mapping
                                            print(f'[DEBUG] Mapped "{value}" to "{value_lower_mapped}" for German level')
                                            break
                                    
                                    # Check if any mapped value matches
                                    if radio_label_text:
                                        label_lower = radio_label_text.lower().strip()
                                        for mapped_val in german_mappings.get(value_lower, []):
                                            if mapped_val in label_lower or label_lower in mapped_val:
                                                matches = True
                                                print(f'[DEBUG] Match found via mapping: "{mapped_val}" in "{label_lower}"')
                                                break
                                
                                # Remote work mappings
                                if 'remote' in field_label.lower() or 'heimarbeit' in field_label.lower():
                                    remote_mappings = {
                                        'ja': ['ja', 'yes', 'y'],
                                        'nein': ['nein', 'no', 'n'],
                                        'yes': ['ja', 'yes'],
                                        'no': ['nein', 'no']
                                    }
                                    
                                    if radio_label_text:
                                        label_lower = radio_label_text.lower().strip()
                                        for key, mapped_values in remote_mappings.items():
                                            if key in value_lower:
                                                for mapped_val in mapped_values:
                                                    if mapped_val in label_lower or label_lower == mapped_val:
                                                        matches = True
                                                        print(f'[DEBUG] Match found via remote mapping: "{mapped_val}" == "{label_lower}"')
                                                        break
                                
                                # Standard matching (if not already matched)
                                if not matches and radio_value:
                                    if radio_value == value_original or radio_value.lower() == value_lower:
                                        matches = True
                                    elif value_lower in radio_value.lower() or radio_value.lower() in value_lower:
                                        matches = True
                                
                                if not matches and radio_label_text:
                                    label_lower = radio_label_text.lower().strip()
                                    if radio_label_text == value_original or label_lower == value_lower:
                                        matches = True
                                    elif value_lower in label_lower or label_lower in value_lower:
                                        matches = True
                                    
                                    # Also check if value contains key parts of label (for complex labels)
                                    if not matches:
                                        # Split label into words and check if value matches any significant word
                                        label_words = [w for w in label_lower.split() if len(w) > 3]
                                        for word in label_words:
                                            if word in value_lower or value_lower in word:
                                                matches = True
                                                print(f'[DEBUG] Match found via word matching: "{word}" in "{value_lower}"')
                                                break
                                
                                if matches:
                                    print(f'[DEBUG] Match found! Radio #{idx}: value="{radio_value}", label="{radio_label_text}"')
                                    await radio.scroll_into_view_if_needed()
                                    await page.wait_for_timeout(100)
                                    await radio.check()
                                    await page.wait_for_timeout(200)
                                    is_checked = await radio.is_checked()
                                    if is_checked:
                                        print(f'[OK] {field_name}: \'{value}\' -> selected (value: {radio_value or "N/A"}, label: {radio_label_text or "N/A"})')
                                        return True
                                    else:
                                        print(f'[DEBUG] Radio checked but is_checked() returned False')
                                else:
                                    print(f'[DEBUG] Radio #{idx} does not match: value="{radio_value}", label="{radio_label_text}", searching for="{value}"')
                        except Exception:
                            continue
            except Exception:
                pass
        
        # Fallback: Try to find radio by searching all radios with the same name and matching label
        try:
            # Extract name from selector more robustly
            name = None
            if name_selector:
                # Try to extract name from various selector formats
                if '[name="' in name_selector:
                    # Extract from format: input[type="radio"][name="question_answers[553]"]
                    start = name_selector.find('[name="') + 7
                    end = name_selector.find('"]', start)
                    if end > start:
                        name = name_selector[start:end]
                elif 'name="' in name_selector:
                    # Extract from format: name="question_answers[553]"
                    start = name_selector.find('name="') + 6
                    end = name_selector.find('"', start)
                    if end > start:
                        name = name_selector[start:end]
                else:
                    # If name_selector is just the name itself
                    name = name_selector.strip()
            
            # Also try to get name from field_name parameter if available
            if not name and field_name:
                name = field_name
            
            if name:
                # For names with special characters like [ and ], we need to use a different approach
                print(f'[DEBUG] Fallback: Searching for name="{name}", value="{value}"')
                # Use evaluate to find radios by name attribute (handles special characters)
                radio_indices = await page.evaluate(f"""
                    () => {{
                        const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
                        const matching = [];
                        radios.forEach((radio, index) => {{
                            if (radio.name === {repr(name)}) {{
                                matching.push(index);
                            }}
                        }});
                        return matching;
                    }}
                """)
                
                # Get all radio buttons and filter by the indices
                all_radios_locator = page.locator('input[type="radio"]')
                all_radios = []
                for idx in radio_indices:
                    try:
                        radio = all_radios_locator.nth(idx)
                        if await radio.count() > 0:
                            all_radios.append(radio)
                    except Exception:
                        continue
                
                print(f'[DEBUG] Fallback: Found {len(all_radios)} radios')
                
                value_lower = value.lower().strip()
                
                for idx, radio in enumerate(all_radios):
                    try:
                        # Get label text using multiple methods
                        radio_label = await radio.evaluate("""
                            (radio) => {
                                // Method 1: By id
                                if (radio.id) {
                                    const label = document.querySelector(`label[for="${radio.id}"]`);
                                    if (label && label.textContent) return label.textContent.trim();
                                }
                                
                                // Method 2: Parent label
                                let current = radio.parentElement;
                                for (let i = 0; i < 5 && current; i++) {
                                    if (current.tagName === 'LABEL') {
                                        return current.textContent.trim();
                                    }
                                    current = current.parentElement;
                                }
                                
                                // Method 3: Sibling label
                                let nextSibling = radio.nextElementSibling;
                                if (nextSibling) {
                                    if (nextSibling.tagName === 'LABEL') {
                                        return nextSibling.textContent.trim();
                                    }
                                    // Check if next sibling contains a label
                                    const labelInSibling = nextSibling.querySelector('label');
                                    if (labelInSibling) {
                                        return labelInSibling.textContent.trim();
                                    }
                                }
                                
                                // Method 4: Previous sibling
                                let prevSibling = radio.previousElementSibling;
                                if (prevSibling && prevSibling.tagName === 'LABEL') {
                                    return prevSibling.textContent.trim();
                                }
                                
                                // Method 5: Find label in parent that contains this radio
                                current = radio.parentElement;
                                for (let i = 0; i < 5 && current; i++) {
                                    const label = current.querySelector('label');
                                    if (label && label.contains(radio)) {
                                        return label.textContent.trim();
                                    }
                                    current = current.parentElement;
                                }
                                
                                return null;
                            }
                        """)
                        
                        radio_value = await radio.get_attribute('value')
                        print(f'[DEBUG] Fallback Radio #{idx}: value="{radio_value}", label="{radio_label}"')
                        
                        # Check if label matches (exact or partial)
                        if radio_label:
                            label_lower = radio_label.lower().strip()
                            # Exact match
                            if label_lower == value_lower:
                                print(f'[DEBUG] Fallback: Exact label match found!')
                                await radio.scroll_into_view_if_needed()
                                await page.wait_for_timeout(100)
                                await radio.check()
                                await page.wait_for_timeout(200)
                                is_checked = await radio.is_checked()
                                if is_checked:
                                    print(f'[OK] {field_name}: \'{value}\' (fallback exact label match)')
                                    return True
                            # Partial match - value in label
                            elif value_lower in label_lower:
                                print(f'[DEBUG] Fallback: Partial label match found! (value in label)')
                                await radio.scroll_into_view_if_needed()
                                await page.wait_for_timeout(100)
                                await radio.check()
                                await page.wait_for_timeout(200)
                                is_checked = await radio.is_checked()
                                if is_checked:
                                    print(f'[OK] {field_name}: \'{value}\' (fallback partial label match)')
                                    return True
                            # Partial match - label in value
                            elif label_lower in value_lower:
                                print(f'[DEBUG] Fallback: Partial label match found! (label in value)')
                                await radio.scroll_into_view_if_needed()
                                await page.wait_for_timeout(100)
                                await radio.check()
                                await page.wait_for_timeout(200)
                                is_checked = await radio.is_checked()
                                if is_checked:
                                    print(f'[OK] {field_name}: \'{value}\' (fallback reverse label match)')
                                    return True
                        
                        # Check if value matches
                        if radio_value:
                            radio_value_lower = radio_value.lower().strip()
                            if radio_value_lower == value_lower or value_lower in radio_value_lower or radio_value_lower in value_lower:
                                print(f'[DEBUG] Fallback: Value match found!')
                                await radio.scroll_into_view_if_needed()
                                await page.wait_for_timeout(100)
                                await radio.check()
                                await page.wait_for_timeout(200)
                                is_checked = await radio.is_checked()
                                if is_checked:
                                    print(f'[OK] {field_name}: \'{value}\' (fallback by value)')
                                    return True
                    except Exception as e:
                        print(f'[DEBUG] Fallback error on radio #{idx}: {str(e)}')
                        continue
        except Exception as e:
            print(f'[DEBUG] Fallback exception: {str(e)}')
            pass
        
        # Try by label text, but only within the same name group
        try:
            name = name_selector.replace('[name="', '').replace('"]', '')
            if name:
                # Find all labels that contain the value text
                all_labels = await page.locator('label').all()
                for label in all_labels:
                    try:
                        label_text = await label.text_content()
                        if label_text and value.lower() in label_text.lower().strip():
                            label_for = await label.get_attribute('for')
                            if label_for:
                                radio = page.locator(f'#{label_for}').first
                                if await radio.count() > 0:
                                    radio_name = await radio.get_attribute('name')
                                    if radio_name == name:
                                        await radio.scroll_into_view_if_needed()
                                        await page.wait_for_timeout(100)
                                        await radio.check()
                                        await page.wait_for_timeout(200)
                                        is_checked = await radio.is_checked()
                                        if is_checked:
                                            print(f'[OK] {field_name}: \'{value}\' (by label for="{label_for}")')
                                            return True
                            else:
                                # Try clicking label directly if it contains the radio
                                try:
                                    radio_in_label = await label.locator(f'input[type="radio"][name="{name}"]').first
                                    if await radio_in_label.count() > 0:
                                        await radio_in_label.scroll_into_view_if_needed()
                                        await page.wait_for_timeout(100)
                                        await radio_in_label.check()
                                        await page.wait_for_timeout(200)
                                        is_checked = await radio_in_label.is_checked()
                                        if is_checked:
                                            print(f'[OK] {field_name}: \'{value}\' (by label click)')
                                            return True
                                except Exception:
                                    pass
                    except Exception:
                        continue
        except Exception:
            pass
        
        # Try clicking label directly within context
        try:
            name = name_selector.replace('[name="', '').replace('"]', '')
            if name and field_label:
                # Find labels that contain the value and are near the field label
                labels = await page.locator('label').filter(has_text=value).all()
                for label in labels:
                    try:
                        # Check if this label is in the same context as field_label
                        label_context = await label.evaluate("""
                            (label) => {
                                let current = label;
                                for (let i = 0; i < 5 && current; i++) {
                                    current = current.parentElement;
                                    if (current && current.textContent) {
                                        const text = current.textContent.trim();
                                        if (text.includes(label.textContent.trim())) {
                                            return text;
                                        }
                                    }
                                }
                                return null;
                            }
                        """)
                        
                        if label_context and field_label.lower() in label_context.lower():
                            await label.scroll_into_view_if_needed()
                            await label.click()
                            await page.wait_for_timeout(200)
                            print(f'[OK] {field_name}: \'{value}\' (by context label)')
                            return True
                    except Exception:
                        continue
        except Exception:
            pass
        
        print(f'[WARNING] {field_name} option \'{value}\' not found')
        return False

