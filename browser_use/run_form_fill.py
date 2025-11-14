"""
Simple script to run form filling directly with Playwright
"""

import asyncio
import sys
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from playwright.async_api import async_playwright
from modules.form_filler import FormFiller


async def main():
    """Main function"""
    url = 'https://www.empfehlungsbund.de/jobs/283194/solution-manager-w-strich-m-strich-x'
    config_path = 'config.json'
    
    print(f"Starting form filling for: {url}\n")
    
    async with async_playwright() as p:
        # Launch browser with options
        browser = await p.chromium.launch(
            headless=False,
            args=['--disable-blink-features=AutomationControlled']
        )
        
        # Create context with realistic user agent
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport={'width': 1920, 'height': 1080},
            locale='en-US',
            timezone_id='Europe/Berlin'
        )
        
        page = await context.new_page()
        
        # Set extra headers
        await page.set_extra_http_headers({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        })
        
        try:
            # Navigate to URL with longer timeout and retry
            print(f'Navigating to: {url}')
            try:
                await page.goto(url, wait_until='domcontentloaded', timeout=120000)
            except Exception as goto_error:
                print(f'First attempt failed: {goto_error}')
                print('Retrying with networkidle...')
                await page.wait_for_timeout(2000)
                await page.goto(url, wait_until='networkidle', timeout=120000)
            
            # Wait for page to load
            print('Page loaded, waiting for content...')
            await page.wait_for_timeout(5000)
            
            # Check if page loaded successfully
            current_url = page.url
            page_title = await page.title()
            print(f'Current URL: {current_url}')
            print(f'Page title: {page_title}')
            
            # Initialize FormFiller
            form_filler = FormFiller(config_path=config_path, page=page)
            
            # Handle cookie consent
            cookie_handled = False
            cookie_does_not_exist = False
            
            for attempt in range(1, 6):
                if attempt > 1:
                    print(f'Waiting 2 seconds before checking cookie consent (attempt {attempt}/5)...')
                    await page.wait_for_timeout(2000)
                
                print(f'Checking for cookie consent (attempt {attempt}/5)...')
                result = await form_filler._handle_cookie_consent()
                
                if result is None:
                    print('Cookie consent popup does not exist on this page')
                    cookie_does_not_exist = True
                    break
                elif result is True:
                    cookie_handled = True
                    print('Waiting for cookie popup to fully close...')
                    await page.wait_for_timeout(2000)
                    break
            
            # If URL has anchor, scroll to it
            if '#' in url:
                anchor = url.split('#')[1]
                print(f'Scrolling to anchor: #{anchor}')
                try:
                    await page.evaluate(f"""
                        (anchorId) => {{
                            let element = document.getElementById(anchorId);
                            if (!element) {{
                                element = document.querySelector(`[name="${{anchorId}}"]`);
                            }}
                            if (!element) {{
                                element = document.querySelector(`a[name="${{anchorId}}"]`);
                            }}
                            if (!element) {{
                                element = document.querySelector(`form#${{anchorId}}`);
                            }}
                            if (!element) {{
                                element = document.querySelector(`form[name="${{anchorId}}"]`);
                            }}
                            if (!element) {{
                                element = document.querySelector(`[id*="${{anchorId}}"], [name*="${{anchorId}}"]`);
                            }}
                            if (element) {{
                                element.scrollIntoView({{ behavior: 'smooth', block: 'center' }});
                                return true;
                            }}
                            return false;
                        }}
                    """, anchor)
                    await page.wait_for_timeout(2000)
                except Exception as e:
                    print(f'Could not scroll to anchor: {str(e)}')
            
            # Wait for form to be visible
            if cookie_handled:
                print('Waiting for form to load after cookie consent...')
                await page.wait_for_timeout(3000)
                await form_filler._handle_cookie_consent()
                await page.wait_for_timeout(2000)
            
            # Check for iframes
            iframes = await page.locator('iframe').all()
            if iframes:
                print(f'Found {len(iframes)} iframe(s), checking for forms inside...')
                for i, iframe in enumerate(iframes):
                    try:
                        frame = await iframe.content_frame()
                        if frame:
                            iframe_form_fields = await frame.evaluate("""
                                () => {
                                    return Array.from(document.querySelectorAll('input, select, textarea')).length;
                                }
                            """)
                            print(f'   Iframe {i + 1}: {iframe_form_fields} form fields found')
                    except Exception:
                        pass
            
            # Fill all form fields
            await form_filler.fill_all_fields()
            
            # Take screenshot
            screenshot_path = 'form_filled.png'
            await page.screenshot(path=screenshot_path, full_page=True)
            print(f'Screenshot saved: {screenshot_path}')
            
            # Ask user if they want to submit
            print('\nForm filled. Review the form in the browser.')
            print('   Press Enter to submit the form, or close the browser to cancel...')
            
            # Wait for user input (optional)
            # input()  # Uncomment if you want to wait for user input
            
            # Auto-submit (set to False to review manually)
            auto_submit = False
            if auto_submit:
                await form_filler._submit_form()
                await page.wait_for_timeout(3000)
                print('Form submitted')
            else:
                print('Form not submitted automatically. Review and submit manually if needed.')
            
            # Keep browser open for review
            print('\nBrowser will remain open for review. Close it when done.')
            await asyncio.sleep(3600)  # Keep open for 1 hour (or until closed)
            
        except Exception as e:
            print(f'\nError: {str(e)}')
            import traceback
            traceback.print_exc()
            
            # Take error screenshot
            try:
                await page.screenshot(path='error_screenshot.png', full_page=True)
                print('Error screenshot saved: error_screenshot.png')
            except Exception:
                pass
        finally:
            # Don't close browser automatically - let user review
            pass


if __name__ == "__main__":
    asyncio.run(main())

