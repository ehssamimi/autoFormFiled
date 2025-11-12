"""
Automated Web Form Filler
This tool automatically fills web forms with predefined data.
Supports text fields, dropdowns, checkboxes, file uploads, and more.
"""

import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError
from typing import List, Optional, Dict, Any


class FormFiller:
    """
    Main class for automating form filling on web pages.
    Uses Playwright for browser automation.
    """
    
    def __init__(self, config_path: str = "config.json"):
        """
        Initialize FormFiller with configuration file.
        
        Args:
            config_path: Path to JSON configuration file containing form data
        """
        self.config_path = config_path
        self.config = self._load_config()
        self.browser = None
        self.page = None
    
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from JSON file."""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            print(f"❌ Config file not found: {self.config_path}")
            raise
        except json.JSONDecodeError:
            print(f"❌ Invalid JSON in config file: {self.config_path}")
            raise
    
    async def fill_form(self, url: str, auto_submit: bool = False):
        """
        Main method to fill a form on the given URL.
        
        Args:
            url: The URL of the web page containing the form
            auto_submit: If True, automatically submits the form after filling
        """
        async with async_playwright() as p:
            # Launch browser based on settings
            headless = self.config.get("settings", {}).get("headless", False)
            self.browser = await p.chromium.launch(headless=headless)
            self.page = await self.browser.new_page()
            
            try:
                print(f"🌐 Navigating to: {url}")
                # Navigate to the form page
                await self.page.goto(url, wait_until="networkidle", timeout=60000)
                
                # Wait for page to fully load
                wait_timeout = self.config.get("settings", {}).get("wait_timeout", 3000)
                await self.page.wait_for_timeout(wait_timeout)
                
                # Fill all form fields
                await self._fill_all_fields()
                
                # Take screenshot before submission (for verification)
                await self.page.screenshot(path="form_filled.png", full_page=True)
                print("📸 Screenshot saved: form_filled.png")
                
                # Submit form if requested
                if auto_submit:
                    await self._submit_form()
                else:
                    print("⏸️  Form filled but not submitted (auto_submit=False)")
                    print("   Review the form in the browser and submit manually if needed")
                
            except PlaywrightTimeoutError:
                print("❌ Timeout: Page took too long to load")
                await self._handle_error()
            except Exception as e:
                print(f"❌ Error occurred: {str(e)}")
                await self._handle_error()
            finally:
                # Keep browser open for manual review if not headless
                if headless or auto_submit:
                    await self.browser.close()
                else:
                    print("🔍 Browser kept open for manual review. Close it when done.")
    
    async def _fill_all_fields(self):
        """Fill all form fields based on configuration."""
        personal_info = self.config.get("personal_info", {})
        
        # Fill text input fields
        if "first_name" in personal_info:
            await self._fill_field(
                selectors=[
                    "input[name='firstname']",
                    "input[name='first_name']",
                    "input[id='firstname']",
                    "input[id='first_name']",
                    "input[placeholder*='First Name' i]",
                    "input[placeholder*='Vorname' i]"
                ],
                value=personal_info["first_name"],
                field_name="First Name"
            )
        
        if "last_name" in personal_info:
            await self._fill_field(
                selectors=[
                    "input[name='lastname']",
                    "input[name='last_name']",
                    "input[id='lastname']",
                    "input[id='last_name']",
                    "input[placeholder*='Last Name' i]",
                    "input[placeholder*='Nachname' i]"
                ],
                value=personal_info["last_name"],
                field_name="Last Name"
            )
        
        if "email" in personal_info:
            await self._fill_field(
                selectors=[
                    "input[type='email']",
                    "input[name='email']",
                    "input[id='email']",
                    "input[placeholder*='Email' i]",
                    "input[placeholder*='E-Mail' i]"
                ],
                value=personal_info["email"],
                field_name="Email"
            )
        
        if "phone" in personal_info:
            await self._fill_field(
                selectors=[
                    "input[type='tel']",
                    "input[name='phone']",
                    "input[name='telephone']",
                    "input[id='phone']",
                    "input[placeholder*='Phone' i]",
                    "input[placeholder*='Telefon' i]"
                ],
                value=personal_info["phone"],
                field_name="Phone"
            )
        
        if "birth_year" in personal_info:
            await self._fill_field(
                selectors=[
                    "input[name='birth_year']",
                    "input[name='year']",
                    "input[id='birth_year']",
                    "select[name='birth_year']",
                    "select[name='year']"
                ],
                value=personal_info["birth_year"],
                field_name="Birth Year"
            )
        
        if "address" in personal_info:
            await self._fill_field(
                selectors=[
                    "textarea[name='address']",
                    "input[name='address']",
                    "textarea[id='address']",
                    "input[id='address']"
                ],
                value=personal_info["address"],
                field_name="Address"
            )
        
        # Handle file uploads
        file_paths = self.config.get("file_paths", {})
        if "resume" in file_paths:
            file_path = file_paths["resume"]
            if os.path.exists(file_path):
                await self._upload_file(
                    selectors=[
                        "input[type='file'][name*='resume' i]",
                        "input[type='file'][name*='cv' i]",
                        "input[type='file'][name*='curriculum' i]",
                        "input[type='file']"
                    ],
                    file_path=file_path,
                    field_name="Resume"
                )
            else:
                print(f"⚠️  Resume file not found: {file_path}")
        
        if "cover_letter" in file_paths:
            file_path = file_paths["cover_letter"]
            if os.path.exists(file_path):
                await self._upload_file(
                    selectors=[
                        "input[type='file'][name*='cover' i]",
                        "input[type='file'][name*='letter' i]",
                        "input[type='file']"
                    ],
                    file_path=file_path,
                    field_name="Cover Letter"
                )
            else:
                print(f"⚠️  Cover letter file not found: {file_path}")
        
        print("✅ All fields processed")
    
    async def _fill_field(
        self, 
        selectors: List[str], 
        value: str, 
        field_name: str = ""
    ) -> bool:
        """
        Try to find and fill a field using multiple selector strategies.
        
        Args:
            selectors: List of CSS selectors to try
            value: Value to fill in the field
            field_name: Human-readable name for logging
        
        Returns:
            True if field was found and filled, False otherwise
        """
        for selector in selectors:
            try:
                # Wait for element to be visible
                element = await self.page.wait_for_selector(
                    selector, 
                    timeout=2000,
                    state="visible"
                )
                if element:
                    # Clear existing value and fill
                    await element.clear()
                    await element.fill(value)
                    print(f"✅ {field_name or selector}: '{value}'")
                    return True
            except PlaywrightTimeoutError:
                continue
            except Exception as e:
                continue
        
        print(f"⚠️  {field_name or 'Field'} not found (tried {len(selectors)} selectors)")
        return False
    
    async def _upload_file(
        self, 
        selectors: List[str], 
        file_path: str, 
        field_name: str = ""
    ) -> bool:
        """
        Upload a file to a file input field.
        
        Args:
            selectors: List of CSS selectors to try
            file_path: Path to the file to upload
            field_name: Human-readable name for logging
        
        Returns:
            True if file was uploaded, False otherwise
        """
        # Convert to absolute path
        abs_path = os.path.abspath(file_path)
        
        if not os.path.exists(abs_path):
            print(f"❌ File not found: {abs_path}")
            return False
        
        for selector in selectors:
            try:
                element = await self.page.wait_for_selector(
                    selector,
                    timeout=2000,
                    state="visible"
                )
                if element:
                    await element.set_input_files(abs_path)
                    print(f"✅ {field_name or 'File'} uploaded: {os.path.basename(abs_path)}")
                    return True
            except PlaywrightTimeoutError:
                continue
            except Exception as e:
                continue
        
        print(f"⚠️  {field_name or 'File upload field'} not found")
        return False
    
    async def _submit_form(self):
        """Submit the form by clicking the submit button."""
        submit_selectors = [
            "button[type='submit']",
            "input[type='submit']",
            "button:has-text('Submit')",
            "button:has-text('Send')",
            "button:has-text('Apply')",
            "button:has-text('Bewerben')",
            "button.btn-primary",
            "button.btn-submit"
        ]
        
        for selector in submit_selectors:
            try:
                button = await self.page.wait_for_selector(selector, timeout=2000)
                if button:
                    await button.click()
                    print("✅ Form submitted")
                    await self.page.wait_for_timeout(3000)
                    return True
            except:
                continue
        
        print("⚠️  Submit button not found")
        return False
    
    async def _handle_error(self):
        """Handle errors by taking a screenshot."""
        screenshot_on_error = self.config.get("settings", {}).get("screenshot_on_error", True)
        if screenshot_on_error:
            try:
                await self.page.screenshot(path="error_screenshot.png", full_page=True)
                print("📸 Error screenshot saved: error_screenshot.png")
            except:
                pass


async def main():
    """
    Main entry point for the script.
    Modify the URL and settings as needed.
    """
    # Initialize form filler
    filler = FormFiller("config.json")
    
    # URL of the form page
    url = "https://jobs.barmer.de/index.php?ac=application&page=2&application_token=9daebbb19d5748fb1496dead72aef7fe33dc5056"
    
    # Fill the form (set auto_submit=True to automatically submit)
    await filler.fill_form(url, auto_submit=False)


if __name__ == "__main__":
    asyncio.run(main())

