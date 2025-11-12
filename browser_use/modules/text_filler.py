"""
Text Field Filler Module
Handles text, email, tel, password, and number inputs
"""

from typing import List


class TextFieldFiller:
    """
    Handles text input fields
    """
    
    @staticmethod
    async def fill(page, selectors: List[str], value: str, field_name: str = '') -> bool:
        """
        Fill a text input field
        """
        for selector in selectors:
            try:
                locator = page.locator(selector).first
                await locator.wait_for(state='visible', timeout=2000)
                
                if await locator.count() > 0:
                    await locator.scroll_into_view_if_needed()
                    await page.wait_for_timeout(50)
                    
                    await locator.focus()
                    await page.wait_for_timeout(50)
                    
                    await locator.clear()
                    await page.wait_for_timeout(50)
                    
                    await locator.fill(value)
                    await page.wait_for_timeout(50)
                    
                    # Verify
                    current_value = await locator.input_value()
                    if current_value == value or value in current_value:
                        print(f'✅ {field_name or selector}: \'{value}\'')
                        return True
                    else:
                        # Try typing if fill didn't work
                        await locator.clear()
                        await locator.type(value, delay=30)
                        typed_value = await locator.input_value()
                        if typed_value == value or value in typed_value:
                            print(f'✅ {field_name or selector}: \'{value}\' (typed)')
                            return True
            except Exception:
                continue
        
        return False
    
    @staticmethod
    def _get_search_terms(field_name: str) -> List[str]:
        """
        Get search terms from field name
        """
        terms = []
        lower_name = field_name.lower()
        
        if 'first' in lower_name or 'vorname' in lower_name:
            terms.extend(['first', 'vorname', 'given'])
        if 'last' in lower_name or 'nachname' in lower_name:
            terms.extend(['last', 'nachname', 'family', 'surname'])
        if 'email' in lower_name or 'e-mail' in lower_name:
            terms.extend(['email', 'e-mail', 'mail'])
        if 'phone' in lower_name or 'telefon' in lower_name:
            terms.extend(['phone', 'telefon', 'tel', 'mobile'])
        
        import re
        words = [w for w in re.split(r'[\s\-_()]+', field_name) if len(w) > 2]
        terms.extend([w.lower() for w in words])
        
        return list(set(terms))
    
    @staticmethod
    async def smart_fill(page, field_name: str, value: str) -> bool:
        """
        Smart detection for text fields
        """
        search_terms = TextFieldFiller._get_search_terms(field_name)
        
        # Try by aria-label
        for term in search_terms:
            try:
                input_locator = page.locator(f'input[aria-label*="{term}" i], textarea[aria-label*="{term}" i]').first
                if await input_locator.count() > 0:
                    await input_locator.scroll_into_view_if_needed()
                    await input_locator.focus()
                    await input_locator.clear()
                    await input_locator.fill(value)
                    print(f'✅ {field_name}: \'{value}\' (smart: aria-label)')
                    return True
            except Exception:
                continue
        
        # Try by aria-labelledby
        for term in search_terms:
            try:
                label = page.locator(f'label:has-text("{term}") i').first
                if await label.count() > 0:
                    label_id = await label.get_attribute('id')
                    if label_id:
                        input_locator = page.locator(f'[aria-labelledby="{label_id}"]').first
                        if await input_locator.count() > 0:
                            await input_locator.scroll_into_view_if_needed()
                            await input_locator.focus()
                            await input_locator.clear()
                            await input_locator.fill(value)
                            print(f'✅ {field_name}: \'{value}\' (smart: aria-labelledby)')
                            return True
            except Exception:
                continue
        
        # Try by label
        for term in search_terms:
            try:
                label = page.locator(f'label:has-text("{term}") i').first
                label_for = await label.get_attribute('for')
                if label_for:
                    input_locator = page.locator(f'#{label_for}').first
                    if await input_locator.count() > 0:
                        await input_locator.scroll_into_view_if_needed()
                        await input_locator.focus()
                        await input_locator.clear()
                        await input_locator.fill(value)
                        print(f'✅ {field_name}: \'{value}\' (smart: label)')
                        return True
            except Exception:
                continue
        
        # Try by autocomplete
        autocomplete_map = {
            'first name': 'given-name',
            'vorname': 'given-name',
            'last name': 'family-name',
            'nachname': 'family-name',
            'email': 'email',
            'e-mail': 'email',
            'phone': 'tel',
            'telefon': 'tel'
        }
        
        for key, autocomplete in autocomplete_map.items():
            if key in field_name.lower():
                try:
                    input_locator = page.locator(f'input[autocomplete="{autocomplete}"], input[autocomplete*="{autocomplete}"]').first
                    if await input_locator.count() > 0:
                        await input_locator.scroll_into_view_if_needed()
                        await input_locator.focus()
                        await input_locator.clear()
                        await input_locator.fill(value)
                        print(f'✅ {field_name}: \'{value}\' (smart: autocomplete)')
                        return True
                except Exception:
                    continue
        
        return False

