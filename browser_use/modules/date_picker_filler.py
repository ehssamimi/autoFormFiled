"""
Date Picker Filler Module
Handles date inputs and datepicker widgets
"""

from typing import List
from .utils import normalize_date, validate_date, get_date_formats


class DatePickerFiller:
    """
    Handles datepicker fields
    """
    
    @staticmethod
    async def fill(page, selectors: List[str], date_value: str, field_name: str = '') -> bool:
        """
        Fill a datepicker field
        """
        normalized_date = normalize_date(date_value)
        parts = normalized_date.split('-')
        if len(parts) != 3:
            return False
        
        year, month, day = parts
        print(f'📅 Normalized date: {normalized_date} (Year: {year}, Month: {month}, Day: {day})')
        
        for selector in selectors:
            try:
                locator = page.locator(selector).first
                
                # Fast check - don't wait long if element doesn't exist
                is_visible = await locator.is_visible()
                if not is_visible:
                    # Try quick wait (500ms max)
                    try:
                        await locator.wait_for(state='visible', timeout=500)
                    except Exception:
                        continue  # Skip to next selector quickly
                
                if await locator.count() > 0:
                    await locator.scroll_into_view_if_needed()
                    
                    input_type = await locator.get_attribute('type')
                    
                    if input_type == 'date':
                        # HTML5 date input
                        await locator.evaluate(f"""
                            (el) => {{
                                el.value = '{normalized_date}';
                                el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                                el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                            }}
                        """)
                        
                        current_value = await locator.input_value()
                        if validate_date(current_value, normalized_date, year, month, day):
                            print(f'✅ {field_name}: \'{current_value}\'')
                            return True
                    else:
                        # Custom datepicker - try with validation and retry
                        filled = await DatePickerFiller._fill_with_validation_and_retry(
                            page, locator, year, month, day, field_name
                        )
                        if filled:
                            return True
            except Exception:
                continue
        
        # Try smart detection if direct selectors failed
        print(f'⚠️  Date field not found with provided selectors, trying smart detection...')
        return await DatePickerFiller._smart_date_picker_detection(page, date_value, field_name)
    
    @staticmethod
    async def _fill_with_validation_and_retry(page, locator, year: str, month: str, day: str, field_name: str) -> bool:
        """
        Fill datepicker with validation and retry mechanism
        """
        month_num = int(month)
        day_num = int(day)
        
        # Strategy 1: Calendar selection with 0-based month index
        success = await DatePickerFiller._try_calendar_selection(page, locator, year, month, day, month_num, day_num, 0, field_name)
        if success:
            return True
        
        # Strategy 2: Calendar selection with 1-based month index
        print(f'🔄 Retrying with 1-based month index...')
        success = await DatePickerFiller._try_calendar_selection(page, locator, year, month, day, month_num, day_num, 1, field_name)
        if success:
            return True
        
        # Strategy 3: Direct fill with different formats
        print(f'🔄 Retrying with direct fill...')
        formats = get_date_formats(year, month, day)
        for date_format in formats:
            try:
                await locator.clear()
                await locator.fill(date_format)
                await page.wait_for_timeout(200)
                await page.keyboard.press('Tab')
                await page.wait_for_timeout(200)
                
                current_value = await locator.input_value()
                if validate_date(current_value, f'{year}-{month}-{day}', year, month, day):
                    print(f'✅ {field_name}: \'{current_value}\' (direct fill)')
                    return True
            except Exception:
                continue
        
        print(f'❌ {field_name}: Failed to fill correctly after all retry attempts')
        return False
    
    @staticmethod
    async def _try_calendar_selection(page, locator, year: str, month: str, day: str, 
                                       month_num: int, day_num: int, month_index_offset: int, field_name: str) -> bool:
        """
        Try calendar selection with specific month index offset
        """
        try:
            await locator.click()
            await page.wait_for_timeout(300)
            
            date_selected = await DatePickerFiller._select_from_calendar(page, year, month, day, month_index_offset)
            if date_selected:
                await page.wait_for_timeout(300)
                current_value = await locator.input_value()
                
                if validate_date(current_value, f'{year}-{month}-{day}', year, month, day):
                    print(f'✅ {field_name}: \'{current_value}\' (calendar, {"0-based" if month_index_offset == 0 else "1-based"})')
                    return True
                else:
                    print(f'⚠️  Validation failed: expected date with {year}-{month}-{day}, got \'{current_value}\'')
        except Exception:
            pass
        
        return False
    
    @staticmethod
    async def _select_from_calendar(page, year: str, month: str, day: str, month_index_offset: int = 0) -> bool:
        """
        Select date from calendar widget
        """
        try:
            day_num = int(day)
            month_num = int(month)
            year_num = int(year)
            
            calendar_selectors = [
                '.calendar', '.datepicker', '.flatpickr-calendar',
                '.ui-datepicker', '[class*="calendar"]', '[class*="datepicker"]',
                '.react-datepicker', '.air-datepicker', '.air-datepicker-body',
                '[class*="react-datepicker"]', '[class*="air-datepicker"]'
            ]
            
            # Wait for calendar
            for cal_selector in calendar_selectors:
                try:
                    calendar = page.locator(cal_selector).first
                    await calendar.wait_for(state='visible', timeout=1000)
                    if await calendar.count() > 0:
                        print(f'📅 Calendar found, selecting year: {year}, month: {month}, day: {day}')
                        
                        # Step 1: Select year (if dropdown exists)
                        try:
                            year_selectors = [
                                f'select:has-text("{year}")',
                                f'select option[value="{year}"]',
                                '[aria-label*="year" i] select',
                                'select[name*="year" i]',
                                '.ui-datepicker-year',
                                'select.ui-datepicker-year'
                            ]
                            
                            for year_selector in year_selectors:
                                try:
                                    year_element = page.locator(year_selector).first
                                    if await year_element.is_visible():
                                        # Try to select year
                                        try:
                                            await year_element.select_option(value=year)
                                            print(f'✅ Year selected: {year}')
                                            await page.wait_for_timeout(200)
                                            break
                                        except Exception:
                                            # Try by text
                                            try:
                                                await year_element.select_option(label=year)
                                                print(f'✅ Year selected by label: {year}')
                                                await page.wait_for_timeout(200)
                                                break
                                            except Exception:
                                                continue
                                except Exception:
                                    continue
                        except Exception:
                            # Year selection failed, continue
                            pass
                        
                        # Step 2: Select month (if dropdown exists)
                        try:
                            month_names = ['January', 'February', 'March', 'April', 'May', 'June',
                                         'July', 'August', 'September', 'October', 'November', 'December']
                            month_names_de = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
                                            'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
                            month_short = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                            month_short_de = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
                                            'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
                            
                            month_name = month_names[month_num - 1]
                            month_name_de = month_names_de[month_num - 1]
                            month_short_name = month_short[month_num - 1]
                            month_short_name_de = month_short_de[month_num - 1]
                            
                            month_selectors = [
                                f'select option[value="{month_num}"]',
                                f'select option[value="{month}"]',
                                f'select option[value="0{month_num}"]',
                                f'select:has-text("{month_name}")',
                                f'select:has-text("{month_name_de}")',
                                f'select:has-text("{month_short_name}")',
                                f'select:has-text("{month_short_name_de}")',
                                '[aria-label*="month" i] select',
                                'select[name*="month" i]',
                                '.ui-datepicker-month',
                                'select.ui-datepicker-month'
                            ]
                            
                            for month_selector in month_selectors:
                                try:
                                    month_element = page.locator(month_selector).first
                                    if await month_element.is_visible():
                                        # Try multiple methods to select month
                                        month_selected = False
                                        
                                        # Method 1: Try by index with offset (0-based or 1-based)
                                        try:
                                            month_index = month_num - 1 + month_index_offset
                                            await month_element.select_option(index=month_index)
                                            print(f'✅ Month selected by index ({"0-based" if month_index_offset == 0 else "1-based"}): {month_index} = month {month_num}')
                                            await page.wait_for_timeout(300)
                                            month_selected = True
                                        except Exception:
                                            # Method 2: Try by value with zero-padding
                                            try:
                                                await month_element.select_option(value=month)
                                                print(f'✅ Month selected by value (padded): {month}')
                                                await page.wait_for_timeout(300)
                                                month_selected = True
                                            except Exception:
                                                # Method 3: Try by value without padding
                                                try:
                                                    await month_element.select_option(value=str(month_num))
                                                    print(f'✅ Month selected by value: {month_num}')
                                                    await page.wait_for_timeout(300)
                                                    month_selected = True
                                                except Exception:
                                                    # Method 4: Try by label (German short name first)
                                                    try:
                                                        await month_element.select_option(label=month_short_name_de)
                                                        print(f'✅ Month selected by short (DE): {month_short_name_de}')
                                                        await page.wait_for_timeout(300)
                                                        month_selected = True
                                                    except Exception:
                                                        # Method 5: Try by label (English short name)
                                                        try:
                                                            await month_element.select_option(label=month_short_name)
                                                            print(f'✅ Month selected by short (EN): {month_short_name}')
                                                            await page.wait_for_timeout(300)
                                                            month_selected = True
                                                        except Exception:
                                                            # Method 6: Try by label (German full name)
                                                            try:
                                                                await month_element.select_option(label=month_name_de)
                                                                print(f'✅ Month selected by label (DE): {month_name_de}')
                                                                await page.wait_for_timeout(300)
                                                                month_selected = True
                                                            except Exception:
                                                                # Method 7: Try by label (English full name)
                                                                try:
                                                                    await month_element.select_option(label=month_name)
                                                                    print(f'✅ Month selected by label (EN): {month_name}')
                                                                    await page.wait_for_timeout(300)
                                                                    month_selected = True
                                                                except Exception:
                                                                    continue
                                        
                                        if month_selected:
                                            break
                                except Exception:
                                    continue
                        except Exception:
                            # Month selection failed, continue
                            pass
                        
                        # Step 3: Select day
                        await page.wait_for_timeout(300)  # Wait for calendar to update
                        day_selectors = [
                            f'button:has-text("{day_num}")',
                            f'td:has-text("{day_num}")',
                            f'a:has-text("{day_num}")',
                            f'[data-day="{day}"]',
                            f'[data-day="{day_num}"]',
                            f'.day:has-text("{day_num}")',
                            f'td a:has-text("{day_num}")'
                        ]
                        
                        for day_selector in day_selectors:
                            try:
                                day_element = page.locator(day_selector).first
                                if await day_element.is_visible():
                                    await day_element.click()
                                    print(f'✅ Day selected: {day_num}')
                                    await page.wait_for_timeout(200)
                                    return True
                            except Exception:
                                continue
                except Exception:
                    continue
        except Exception as e:
            print(f'⚠️  Calendar selection error: {str(e)}')
        
        return False
    
    @staticmethod
    async def _smart_date_picker_detection(page, date_value: str, field_name: str) -> bool:
        """
        Smart date picker detection by label/aria-label
        """
        normalized_date = normalize_date(date_value)
        parts = normalized_date.split('-')
        if len(parts) != 3:
            return False
        
        year, month, day = parts
        
        search_terms = ['geburtsdatum', 'birth date', 'date of birth', 'geburt', 'datum', 'date_of_birth']
        
        for term in search_terms:
            try:
                # Try by label text (case insensitive)
                label = page.locator(f'label:has-text("{term}") i').first
                label_count = await label.count()
                if label_count > 0:
                    label_for = await label.get_attribute('for')
                    if label_for:
                        input_locator = page.locator(f'#{label_for}').first
                        if await input_locator.is_visible():
                            print(f'✅ Found field by label "for" attribute: #{label_for}')
                            filled = await DatePickerFiller.fill(page, [f'#{label_for}'], date_value, field_name)
                            if filled:
                                return True
                
                # Try by aria-label
                aria_input = page.locator(f'input[aria-label*="{term}" i]').first
                if await aria_input.is_visible():
                    print(f'✅ Found field by aria-label')
                    filled = await DatePickerFiller.fill(page, [f'input[aria-label*="{term}" i]'], date_value, field_name)
                    if filled:
                        return True
                
                # Try by name or id containing the term
                name_input = page.locator(f'input[name*="{term}" i], input[id*="{term}" i]').first
                if await name_input.is_visible():
                    name = await name_input.get_attribute('name')
                    field_id = await name_input.get_attribute('id')
                    selector = f'input[name="{name}"]' if name else (f'input[id="{field_id}"]' if field_id else None)
                    if selector:
                        print(f'✅ Found field by name/id: {selector}')
                        filled = await DatePickerFiller.fill(page, [selector], date_value, field_name)
                        if filled:
                            return True
            except Exception:
                continue
        
        print(f'❌ Birth Date field not found')
        return False

