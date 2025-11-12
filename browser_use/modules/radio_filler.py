"""
Radio Button Filler Module
Handles radio button groups
"""


class RadioFieldFiller:
    """
    Handles radio button selection
    """
    
    @staticmethod
    async def fill(page, name_selector: str, value: str, field_name: str = '') -> bool:
        """
        Select a radio button
        """
        try:
            # Try by value attribute
            value_selector = f'{name_selector}[value="{value}"]'
            element = page.locator(value_selector).first
            await element.wait_for(state='visible', timeout=2000)
            
            if await element.count() > 0:
                await element.check()
                print(f'✅ {field_name}: \'{value}\'')
                return True
        except Exception:
            # Try by label text
            try:
                label = page.locator(f'label:has-text("{value}")').first
                radio_id = await label.get_attribute('for')
                if radio_id:
                    radio = page.locator(f'#{radio_id}').first
                    if await radio.count() > 0:
                        await radio.check()
                        print(f'✅ {field_name}: \'{value}\' (by label)')
                        return True
            except Exception:
                # Try clicking label directly
                try:
                    label = page.locator(f'label:has-text("{value}")').first
                    if await label.count() > 0:
                        await label.click()
                        print(f'✅ {field_name}: \'{value}\' (by label click)')
                        return True
                except Exception:
                    # Try partial match
                    try:
                        label = page.locator('label').filter(has_text=value).first
                        if await label.count() > 0:
                            await label.click()
                            print(f'✅ {field_name}: \'{value}\' (partial match)')
                            return True
                    except Exception:
                        pass
        
        print(f'⚠️  {field_name} option \'{value}\' not found')
        return False

