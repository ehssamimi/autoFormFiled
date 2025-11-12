"""
Browser-Use Form Filling Tools
Integrates advanced form filling logic with Browser-Use framework
"""

import os
import json
from pathlib import Path
from typing import Optional, Dict, Any

from browser_use import Agent, BrowserSession, Tools, ActionResult
from pydantic import BaseModel, Field

# Import our form filling modules
from .modules.form_filler import FormFiller
from .modules.text_filler import TextFieldFiller
from .modules.select_filler import SelectFieldFiller
from .modules.date_picker_filler import DatePickerFiller
from .modules.file_upload_filler import FileUploadFiller
from .modules.radio_filler import RadioFieldFiller
from .modules.checkbox_filler import CheckboxFieldFiller


# Pydantic model for tool parameters
class FillFormAction(BaseModel):
    """Parameters for fill_web_form action"""
    url: str = Field(..., description="URL of the web page containing the form")
    config_path: str = Field(default="config.json", description="Path to JSON configuration file")
    auto_submit: bool = Field(default=False, description="If True, automatically submits the form after filling")


# Initialize Browser-Use tools
tools = Tools()


@tools.registry.action(
    name="fill_web_form",
    description="Automatically fills a web form with predefined data from config.json. Supports text fields, dropdowns, checkboxes, file uploads, date pickers, and more. Handles cookie consent popups, dynamic fields, and form submission.",
    model=FillFormAction
)
async def fill_web_form(
    action: FillFormAction,
    browser_session: BrowserSession
) -> ActionResult:
    """
    Fill a web form automatically using configuration data
    
    Args:
        action: FillFormAction with URL, config_path, and auto_submit
        browser_session: Browser-Use browser session
    
    Returns:
        ActionResult with success status and message
    """
    try:
        # Get Playwright page from browser session
        page = browser_session.must_get_current_page()
        
        # Resolve config path (relative to browser_use folder)
        config_path = action.config_path
        if not os.path.isabs(config_path):
            # Make relative to browser_use folder
            browser_use_dir = Path(__file__).parent
            config_path = str(browser_use_dir / config_path)
        
        # Initialize FormFiller
        form_filler = FormFiller(config_path=config_path, page=page)
        
        # Navigate to URL if not already there
        current_url = page.url
        if current_url != action.url:
            print(f'🌐 Navigating to: {action.url}')
            await page.goto(
                action.url,
                wait_until='domcontentloaded',
                timeout=90000
            )
            
            # Wait for page to load
            wait_timeout = form_filler.config.get('settings', {}).get('wait_timeout', 5000)
            await page.wait_for_timeout(wait_timeout)
        
        # Handle cookie consent
        cookie_handled = False
        cookie_does_not_exist = False
        
        for attempt in range(1, 6):
            if attempt > 1:
                print(f'⏳ Waiting 2 seconds before checking cookie consent (attempt {attempt}/5)...')
                await page.wait_for_timeout(2000)
            
            print(f'🍪 Checking for cookie consent (attempt {attempt}/5)...')
            result = await form_filler._handle_cookie_consent()
            
            if result is None:
                print('ℹ️  Cookie consent popup does not exist on this page')
                cookie_does_not_exist = True
                break
            elif result is True:
                cookie_handled = True
                print('⏳ Waiting for cookie popup to fully close...')
                await page.wait_for_timeout(2000)
                break
        
        # If URL has anchor, scroll to it
        if '#' in action.url:
            anchor = action.url.split('#')[1]
            print(f'📍 Scrolling to anchor: #{anchor}')
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
                print(f'⚠️  Could not scroll to anchor: {str(e)}')
        
        # Wait for form to be visible
        if cookie_handled:
            print('⏳ Waiting for form to load after cookie consent...')
            await page.wait_for_timeout(3000)
            await form_filler._handle_cookie_consent()
            await page.wait_for_timeout(2000)
        
        # Check for iframes
        iframes = await page.locator('iframe').all()
        if iframes:
            print(f'🔍 Found {len(iframes)} iframe(s), checking for forms inside...')
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
        print(f'📸 Screenshot saved: {screenshot_path}')
        
        # Submit form if requested
        if action.auto_submit:
            await form_filler._submit_form()
            await page.wait_for_timeout(3000)
            
            # Check for success message or errors
            try:
                success_indicators = await page.evaluate("""
                    () => {
                        const indicators = [];
                        const successSelectors = [
                            '[class*="success"]',
                            '[id*="success"]',
                            '[class*="thank"]',
                            '[id*="thank"]',
                            'h1:has-text("Thank")',
                            'h1:has-text("Danke")',
                            'h2:has-text("Thank")',
                            'h2:has-text("Danke")'
                        ];
                        successSelectors.forEach(sel => {
                            try {
                                const el = document.querySelector(sel);
                                if (el && el.textContent) {
                                    indicators.push(el.textContent.trim());
                                }
                            } catch (e) {}
                        });
                        return indicators;
                    }
                """)
                
                if success_indicators:
                    return ActionResult(
                        success=True,
                        result=f"Form filled and submitted successfully. Success indicators: {', '.join(success_indicators[:3])}"
                    )
            except Exception:
                pass
            
            return ActionResult(
                success=True,
                result="Form filled and submitted successfully"
            )
        else:
            return ActionResult(
                success=True,
                result="Form filled successfully. Review the form in the browser and submit manually if needed."
            )
    
    except Exception as e:
        error_message = f"Error filling form: {str(e)}"
        print(f'❌ {error_message}')
        return ActionResult(
            success=False,
            result=error_message
        )


# Example usage function
async def example_usage():
    """
    Example showing how to use the form filling tool with Browser-Use Agent
    """
    # URL to fill
    url = "https://www.finest-jobs.com/Bewerbung/Sales-Manager-D-Online-Marketing-727662?cp=BA"
    
    # Initialize Browser-Use Agent
    agent = Agent(
        task="Fill the web form at the given URL with data from config.json",
        tools=tools
    )
    
    # Run the agent
    result = await agent.run(url)
    print(result)


if __name__ == "__main__":
    import asyncio
    
    # Run example
    asyncio.run(example_usage())

