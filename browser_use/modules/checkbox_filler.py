"""
Checkbox Filler Module
Handles checkbox fields
"""


class CheckboxFieldFiller:
    """
    Handles checkbox checking
    """
    
    @staticmethod
    async def fill(page, selectors: list, value: bool, field_name: str = '') -> bool:
        """
        Check/uncheck a checkbox
        """
        for selector in selectors:
            try:
                locator = page.locator(selector).first
                await locator.wait_for(state='visible', timeout=2000)
                
                if await locator.count() > 0:
                    is_checked = await locator.is_checked()
                    
                    if value and not is_checked:
                        await locator.check()
                        print(f'✅ {field_name}: checked')
                        return True
                    elif not value and is_checked:
                        await locator.uncheck()
                        print(f'✅ {field_name}: unchecked')
                        return True
                    else:
                        print(f'ℹ️  {field_name}: already {"checked" if is_checked else "unchecked"}')
                        return True
            except Exception:
                continue
        
        return False

