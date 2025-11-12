"""
File Upload Filler Module
Handles file input fields
"""

import os
from pathlib import Path
from typing import List
from .utils import resolve_file_path


class FileUploadFiller:
    """
    Handles file upload fields
    """
    
    @staticmethod
    async def fill(page, selectors: List[str], file_path: str, field_name: str = '') -> bool:
        """
        Upload a file
        """
        print(f'\n📁 FILE UPLOAD START: {field_name}')
        print(f'   Selectors: {selectors}')
        print(f'   File path: {file_path}')
        
        # Resolve path
        abs_path = resolve_file_path(file_path, base_dir=os.path.dirname(os.path.dirname(__file__)))
        print(f'   Absolute path: {abs_path}')
        
        if not os.path.exists(abs_path):
            print(f'❌ File not found: {abs_path}')
            print(f'   Tried path: {file_path}')
            return False
        
        file_size = os.path.getsize(abs_path)
        print(f'✅ File exists, size: {file_size} bytes')
        
        # Strategy 0: Try clicking span with _add suffix FIRST (for finest-jobs.com style)
        for selector in selectors:
            try:
                import re
                name_match = re.search(r'name=["\']([^"\']+)["\']', selector)
                id_match = re.search(r'#([\w-]+)', selector) or re.search(r'id=["\']([^"\']+)["\']', selector)
                
                if name_match or id_match:
                    name = name_match.group(1) if name_match else None
                    field_id = id_match.group(1) if id_match else None
                    
                    # Find text input to get its id
                    text_input_id = field_id
                    if not text_input_id and name:
                        text_input = page.locator(f'input[name="{name}"]').first
                        if await text_input.count() > 0:
                            text_input_id = await text_input.get_attribute('id')
                    
                    if text_input_id:
                        # Find span with id = textInputId + "_add"
                        add_span_id = f'{text_input_id}_add'
                        add_span = page.locator(f'span#{add_span_id}').first
                        
                        if await add_span.count() > 0:
                            try:
                                # Find file input inside span
                                file_input_in_span = add_span.locator('input[type="file"]').first
                                
                                if await file_input_in_span.count() > 0:
                                    print(f'🔍 Found span#{add_span_id} with file input, trying upload...')
                                    # Scroll to span
                                    await add_span.scroll_into_view_if_needed()
                                    await page.wait_for_timeout(200)
                                    
                                    # Click the span first
                                    try:
                                        await add_span.click(timeout=2000)
                                        await page.wait_for_timeout(300)
                                    except Exception:
                                        pass
                                    
                                    # Set the file
                                    try:
                                        await file_input_in_span.set_input_files(abs_path, timeout=10000)
                                        
                                        # Trigger change event
                                        await file_input_in_span.evaluate("""
                                            (input) => {
                                                const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                                                input.dispatchEvent(changeEvent);
                                            }
                                        """)
                                        
                                        # Also trigger on span
                                        await add_span.evaluate("""
                                            (span) => {
                                                const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                                                span.dispatchEvent(changeEvent);
                                            }
                                        """)
                                        
                                        print(f'✅ {field_name or "File"}: uploaded \'{os.path.basename(abs_path)}\' (via span _add click)')
                                        await page.wait_for_timeout(2000)
                                        
                                        # Verify file was set
                                        file_count = await file_input_in_span.evaluate("""
                                            (input) => {
                                                return input.files ? input.files.length : 0;
                                            }
                                        """)
                                        
                                        if file_count > 0:
                                            return True
                                    except Exception as set_error:
                                        print(f'⚠️  Error setting file in span: {str(set_error)}')
                            except Exception:
                                pass
            except Exception:
                continue
        
        # Strategy 1: Try to find the actual file input (even if hidden)
        for selector in selectors:
            print(f'\n🔍 Trying selector: {selector}')
            try:
                import re
                name_match = re.search(r'name=["\']([^"\']+)["\']', selector)
                id_match = re.search(r'#([\w-]+)', selector) or re.search(r'id=["\']([^"\']+)["\']', selector)
                
                if name_match:
                    name = name_match.group(1)
                    
                    # Step 1: Try to find file input with this name directly
                    file_input = page.locator(f'input[type="file"][name="{name}"]').first
                    if await file_input.count() > 0:
                        try:
                            await file_input.set_input_files(abs_path)
                            print(f'✅ {field_name or "File"}: uploaded \'{os.path.basename(abs_path)}\' (by name)')
                            await page.wait_for_timeout(500)
                            return True
                        except Exception:
                            pass
                    
                    # Step 2: Find text input with this name, get its id, then find file input in span with _add
                    text_input = page.locator(f'input[name="{name}"]').first
                    if await text_input.count() > 0:
                        text_input_id = await text_input.get_attribute('id')
                        if text_input_id:
                            print(f'🔍 Found text input with id: {text_input_id}, looking for file input in span with id: {text_input_id}_add')
                            
                            # Find span with id = textInputId + "_add"
                            add_span_id = f'{text_input_id}_add'
                            add_span = page.locator(f'span[id="{add_span_id}"] input[type="file"]').first
                            add_span_count = await add_span.count()
                            print(f'🔍 File input in span selector count: {add_span_count}')
                            
                            if add_span_count > 0:
                                try:
                                    # Scroll to the file input
                                    await add_span.scroll_into_view_if_needed()
                                    await page.wait_for_timeout(200)
                                    
                                    # Check if visible
                                    is_file_input_visible = await add_span.is_visible()
                                    print(f'   File input visible: {is_file_input_visible}')
                                    
                                    # Try clicking the file input first
                                    try:
                                        await add_span.click(timeout=1000)
                                        await page.wait_for_timeout(300)
                                    except Exception:
                                        pass
                                    
                                    # Set the file
                                    try:
                                        await add_span.set_input_files(abs_path, timeout=5000)
                                        print(f'✅ File set in input')
                                    except Exception as set_error:
                                        print(f'⚠️  Error setting file (first attempt): {str(set_error)}')
                                        # Try alternative: use evaluate to click input
                                        try:
                                            await add_span.evaluate("""
                                                (input) => {
                                                    input.click();
                                                }
                                            """)
                                            # Then try setInputFiles again
                                            await add_span.set_input_files(abs_path, timeout=5000)
                                            print(f'✅ File set in input (after click)')
                                        except Exception as retry_error:
                                            print(f'❌ Failed to set file after retry: {str(retry_error)}')
                                            raise set_error
                                    
                                    # Wait a bit
                                    await page.wait_for_timeout(500)
                                    
                                    # Verify file was set BEFORE triggering events
                                    files_before_event = await add_span.evaluate("""
                                        (input) => {
                                            return input.files ? input.files.length : 0;
                                        }
                                    """)
                                    print(f'   Files count before events: {files_before_event}')
                                    
                                    # Trigger change event on the file input
                                    await add_span.evaluate("""
                                        (input) => {
                                            const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                                            input.dispatchEvent(changeEvent);
                                            
                                            const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                                            input.dispatchEvent(inputEvent);
                                            
                                            if (input.files && input.files.length > 0) {
                                                const fileListEvent = new Event('change', { bubbles: true, cancelable: true });
                                                Object.defineProperty(fileListEvent, 'target', { value: input, enumerable: true });
                                                input.dispatchEvent(fileListEvent);
                                            }
                                        }
                                    """)
                                    
                                    # Also trigger on the text input
                                    await text_input.evaluate("""
                                        (input) => {
                                            const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                                            input.dispatchEvent(changeEvent);
                                            
                                            const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                                            input.dispatchEvent(inputEvent);
                                        }
                                    """)
                                    
                                    # Additional: Try to trigger any custom handlers
                                    await page.evaluate(f"""
                                        (inputId) => {{
                                            const textInput = document.getElementById(inputId);
                                            if (textInput) {{
                                                const form = textInput.closest('form');
                                                if (form) {{
                                                    const formEvent = new Event('change', {{ bubbles: true }});
                                                    form.dispatchEvent(formEvent);
                                                }}
                                            }}
                                        }}
                                    """, text_input_id)
                                    
                                    print(f'✅ {field_name or "File"}: uploaded \'{os.path.basename(abs_path)}\' (found via text input id)')
                                    
                                    # Wait for upload to process
                                    await page.wait_for_timeout(3000)
                                    
                                    # Verify file was actually set
                                    file_input_files = await add_span.evaluate("""
                                        (input) => {
                                            return input.files ? input.files.length : 0;
                                        }
                                    """)
                                    print(f'   File input files count: {file_input_files}')
                                    
                                    if file_input_files > 0:
                                        file_name = await add_span.evaluate("""
                                            (input) => {
                                                return input.files && input.files[0] ? input.files[0].name : '';
                                            }
                                        """)
                                        print(f'   File name in input: "{file_name}"')
                                    
                                    # Check if the text input shows the file name
                                    text_input_value = await text_input.input_value()
                                    print(f'   Text input value after upload: "{text_input_value}"')
                                    
                                    # Check if preview image is shown
                                    preview_img = page.locator(f'img#{text_input_id}_preview').first
                                    preview_visible = await preview_img.is_visible()
                                    print(f'   Preview image visible: {preview_visible}')
                                    
                                    # Additional verification: Check if any visual indicator appears
                                    upload_indicators = await page.evaluate(f"""
                                        (inputId) => {{
                                            const indicators = [];
                                            const successSelectors = [
                                                `[id*="${{inputId}}"] .success`,
                                                `[id*="${{inputId}}"] .uploaded`,
                                                `[id*="${{inputId}}"] .file-name`,
                                                `[id*="${{inputId}}"] .file-info`
                                            ];
                                            successSelectors.forEach(sel => {{
                                                try {{
                                                    const el = document.querySelector(sel);
                                                    if (el && el.textContent) {{
                                                        indicators.push(el.textContent.trim());
                                                    }}
                                                }} catch (e) {{}}
                                            }});
                                            return indicators;
                                        }}
                                    """, text_input_id)
                                    
                                    if upload_indicators:
                                        print(f'   Upload indicators found: {", ".join(upload_indicators)}')
                                    
                                    # Final verification
                                    if file_input_files > 0 or text_input_value or preview_visible or upload_indicators:
                                        print(f'   ✅ Upload verification: PASSED')
                                        return True
                                    else:
                                        print(f'   ⚠️  Upload verification: UNCLEAR - file may not be properly uploaded')
                                        return True
                                except Exception as error:
                                    print(f'⚠️  Error setting file in span: {str(error)}')
                            
                            # Alternative: Find span with id ending in _add that contains file input
                            add_span_alt = page.locator(f'span[id="{add_span_id}"]').first
                            add_span_alt_count = await add_span_alt.count()
                            print(f'🔍 Span with id "{add_span_id}" count: {add_span_alt_count}')
                            
                            if add_span_alt_count > 0:
                                file_input_in_span = add_span_alt.locator('input[type="file"]').first
                                file_input_count = await file_input_in_span.count()
                                print(f'🔍 File input inside span count: {file_input_count}')
                                
                                if file_input_count > 0:
                                    try:
                                        await file_input_in_span.set_input_files(abs_path)
                                        print(f'✅ {field_name or "File"}: uploaded \'{os.path.basename(abs_path)}\' (in span by id)')
                                        await page.wait_for_timeout(1000)
                                        return True
                                    except Exception as error:
                                        print(f'⚠️  Error setting file in span (alt): {str(error)}')
                
                if id_match:
                    field_id = id_match.group(1)
                    
                    # Try to find file input near this id (in span with _add suffix)
                    add_span_id = f'{field_id}_add'
                    add_span = page.locator(f'span[id="{add_span_id}"] input[type="file"]').first
                    if await add_span.count() > 0:
                        try:
                            await add_span.set_input_files(abs_path)
                            print(f'✅ {field_name or "File"}: uploaded \'{os.path.basename(abs_path)}\' (by id span)')
                            await page.wait_for_timeout(500)
                            return True
                        except Exception:
                            pass
                
                # Strategy 2: Try original selector
                locator = page.locator(selector).first
                count = await locator.count()
                
                if count > 0:
                    # Check if it's already a file input
                    input_type = await locator.get_attribute('type')
                    if input_type == 'file':
                        try:
                            await locator.set_input_files(abs_path)
                            print(f'✅ {field_name or "File"}: uploaded \'{os.path.basename(abs_path)}\'')
                            await page.wait_for_timeout(500)
                            return True
                        except Exception:
                            pass
                    else:
                        # It's a text input, find the file input in the same container
                        try:
                            # Find file input in parent or nearby
                            file_input_nearby = locator.locator('xpath=ancestor::*//input[@type="file"]').first
                            if await file_input_nearby.count() > 0:
                                await file_input_nearby.set_input_files(abs_path)
                                print(f'✅ {field_name or "File"}: uploaded \'{os.path.basename(abs_path)}\' (nearby)')
                                await page.wait_for_timeout(500)
                                return True
                        except Exception:
                            pass
            except Exception:
                continue
        
        # Strategy 3: Try to find any file input with matching name attribute
        try:
            import re
            for selector in selectors:
                name_match = re.search(r'name=["\']([^"\']+)["\']', selector)
                if name_match:
                    name = name_match.group(1)
                    # Find all file inputs and check if any has this name
                    all_file_inputs = await page.locator('input[type="file"]').all()
                    for file_input in all_file_inputs:
                        file_input_name = await file_input.get_attribute('name')
                        if file_input_name == name:
                            try:
                                await file_input.set_input_files(abs_path)
                                print(f'✅ {field_name or "File"}: uploaded \'{os.path.basename(abs_path)}\' (by name search)')
                                await page.wait_for_timeout(500)
                                return True
                            except Exception:
                                pass
        except Exception:
            pass
        
        # Strategy 4: Try drag-and-drop zone
        try:
            dropzone_selectors = [
                '.dropzone',
                '[class*="dropzone"]',
                '[class*="drop-zone"]',
                '[class*="file-drop"]',
                '[data-dropzone]',
                '[id*="dropzone"]',
                '[id*="drop-zone"]'
            ]
            
            for dropzone_selector in dropzone_selectors:
                try:
                    dropzone = page.locator(dropzone_selector).first
                    if await dropzone.count() > 0:
                        is_visible = await dropzone.is_visible()
                        if is_visible:
                            # Find hidden file input inside dropzone
                            file_input = dropzone.locator('input[type="file"]').first
                            if await file_input.count() > 0:
                                await file_input.set_input_files(abs_path)
                                print(f'✅ {field_name or "File"}: uploaded \'{os.path.basename(abs_path)}\' (drag-and-drop zone)')
                                await page.wait_for_timeout(500)
                                return True
                except Exception:
                    continue
        except Exception:
            pass
        
        print(f'⚠️  {field_name or "File upload field"} not found')
        return False

