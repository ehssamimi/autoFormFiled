"""
Form Filler Core Module
Main FormFiller class that orchestrates form filling
"""

import json
import os
from typing import Dict, List, Optional, Any, Set
from pathlib import Path

from .text_filler import TextFieldFiller
from .select_filler import SelectFieldFiller
from .date_picker_filler import DatePickerFiller
from .file_upload_filler import FileUploadFiller
from .radio_filler import RadioFieldFiller
from .checkbox_filler import CheckboxFieldFiller
from .field_detector import FieldDetector
from .utils import resolve_file_path


class FormFiller:
    """
    Main class for automating form filling on web pages
    """
    
    def __init__(self, config_path: str = "config.json", page=None):
        """
        Initialize FormFiller with configuration file
        
        Args:
            config_path: Path to JSON configuration file
            page: Playwright page object (optional, can be set later)
        """
        self.config_path = config_path
        self.config = self._load_config()
        self.page = page
    
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from JSON file"""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            print(f"[ERROR] Config file not found: {self.config_path}")
            raise
        except json.JSONDecodeError:
            print(f"[ERROR] Invalid JSON in config file: {self.config_path}")
            raise
    
    async def _handle_cookie_consent(self) -> Optional[bool]:
        """
        Handle cookie consent popup
        Returns:
            True if cookie was found and handled
            False if cookie exists but couldn't be handled
            None if cookie doesn't exist on page
        """
        if not self.page:
            return None
        
        try:
            # Quick check: wait for cookie wrapper with short timeout
            try:
                await self.page.wait_for_selector(
                    '[id*="cookie"], [class*="cookie"], [id*="consent"], [class*="consent"], [id*="gdpr"], [class*="gdpr"]',
                    timeout=1500
                )
            except Exception:
                # No cookie wrapper found - cookie doesn't exist
                return None
            
            # Cookie wrapper exists, check for buttons
            cookie_selectors = [
                'button:has-text("Alle akzeptieren")',
                'button:has-text("Accept all")',
                'button:has-text("Akzeptieren")',
                'button:has-text("Accept")',
                '[id*="accept"], [class*="accept"]',
                '[id*="cookie"] button',
                '[class*="cookie"] button',
                'button[aria-label*="accept" i]',
                'button[aria-label*="akzeptieren" i]',
                '.cookie-consent button',
                '#cookie-consent button'
            ]
            
            for selector in cookie_selectors:
                try:
                    button = self.page.locator(selector).first
                    if await button.count() > 0:
                        is_visible = await button.is_visible()
                        if is_visible:
                            await button.scroll_into_view_if_needed()
                            await button.click()
                            print('[OK] Cookie consent accepted')
                            await self.page.wait_for_timeout(1000)
                            return True
                except Exception:
                    continue
            
            # Try close button
            close_selectors = [
                'button[aria-label*="close" i]',
                'button[aria-label*="schließen" i]',
                '.close, .modal-close, [class*="close"]',
                'button:has-text("×")',
                'button:has-text("✕")'
            ]
            
            for selector in close_selectors:
                try:
                    button = self.page.locator(selector).first
                    if await button.count() > 0:
                        is_visible = await button.is_visible()
                        if is_visible:
                            await button.scroll_into_view_if_needed()
                            await button.click()
                            print('[OK] Cookie popup closed')
                            await self.page.wait_for_timeout(1000)
                            return True
                except Exception:
                    continue
            
            # Cookie wrapper exists but no button found
            return False
        except Exception as e:
            print(f'[WARNING] Cookie consent check error: {str(e)}')
            return None
    
    async def _get_form_fields_in_order(self) -> List:
        """
        Get all form fields sorted by position (top to bottom)
        """
        if not self.page:
            return []
        
        try:
            # Get all form elements
            fields = await self.page.evaluate("""
                () => {
                    const allFields = [];
                    const selectors = [
                        'input:not([type="hidden"]):not([type="submit"]):not([type="button"])',
                        'select',
                        'textarea',
                        '[role="textbox"]',
                        '[role="combobox"]',
                        '[role="listbox"]',
                        '[contenteditable="true"]'
                    ];
                    
                    selectors.forEach(sel => {
                        document.querySelectorAll(sel).forEach(field => {
                            const style = window.getComputedStyle(field);
                            const isVisible = (
                                style.display !== 'none' &&
                                style.visibility !== 'hidden' &&
                                style.opacity !== '0' &&
                                field.offsetWidth > 0 &&
                                field.offsetHeight > 0 &&
                                !field.disabled &&
                                !field.readOnly
                            );
                            
                            if (isVisible) {
                                const rect = field.getBoundingClientRect();
                                allFields.push({
                                    name: field.name || '',
                                    id: field.id || '',
                                    type: field.type || field.tagName.toLowerCase(),
                                    x: rect.left,
                                    y: rect.top,
                                    selector: sel
                                });
                            }
                        });
                    });
                    
                    // Sort by position (top to bottom, left to right)
                    allFields.sort((a, b) => {
                        if (Math.abs(a.y - b.y) < 10) {
                            return a.x - b.x; // Same row, sort by x
                        }
                        return a.y - b.y; // Sort by y
                    });
                    
                    return allFields;
                }
            """)
            
            # Convert to locators
            field_locators = []
            for field in fields:
                selectors_to_try = []
                if field['id']:
                    selectors_to_try.append(f'#{field["id"]}')
                if field['name']:
                    selectors_to_try.append(f'[name="{field["name"]}"]')
                if field['type']:
                    selectors_to_try.append(f'{field["type"]}')
                
                # Try to find the field
                for selector in selectors_to_try:
                    try:
                        locator = self.page.locator(selector).first
                        if await locator.count() > 0:
                            is_visible = await locator.is_visible()
                            if is_visible:
                                field_locators.append(locator)
                                break
                    except Exception:
                        continue
            
            return field_locators
        except Exception as e:
            print(f'[WARNING] Error getting form fields: {str(e)}')
            return []
    
    async def _get_field_info(self, locator) -> Dict[str, Any]:
        """
        Get field metadata
        """
        try:
            field_type = await FieldDetector.detect_type(locator)
            name = await locator.get_attribute('name')
            field_id = await locator.get_attribute('id')
            placeholder = await locator.get_attribute('placeholder')
            label = await FieldDetector.get_label(locator)
            
            return {
                'type': field_type,
                'name': name,
                'id': field_id,
                'placeholder': placeholder,
                'label': label
            }
        except Exception:
            return {'type': 'unknown'}
    
    def _get_config_value_for_field(self, field_info: Dict, personal_info: Dict, 
                                     file_paths: Dict, questions: Dict, talent_pool: Dict) -> Optional[Any]:
        """
        Get config value for a field based on field mappings
        """
        field_name = (field_info.get('name') or '').lower()
        field_id = (field_info.get('id') or '').lower()
        label = (field_info.get('label') or '').lower()
        
        # Field mappings
        field_mappings = {
            'first_name': personal_info.get('first_name'),
            'firstname': personal_info.get('first_name'),
            'vorname': personal_info.get('first_name'),
            'first name': personal_info.get('first_name'),
            'given-name': personal_info.get('first_name'),
            'last_name': personal_info.get('last_name'),
            'lastname': personal_info.get('last_name'),
            'nachname': personal_info.get('last_name'),
            'last name': personal_info.get('last_name'),
            'family-name': personal_info.get('last_name'),
            'email': personal_info.get('email'),
            'e-mail': personal_info.get('email'),
            'phone': personal_info.get('phone'),
            'telephone': personal_info.get('phone'),
            'telefon': personal_info.get('phone'),
            'tel': personal_info.get('phone'),
            'date_of_birth': personal_info.get('date_of_birth') or personal_info.get('birth_date'),
            'birth_date': personal_info.get('date_of_birth') or personal_info.get('birth_date'),
            'geburtsdatum': personal_info.get('date_of_birth') or personal_info.get('birth_date'),
            'birth date': personal_info.get('date_of_birth') or personal_info.get('birth_date'),
            'date of birth': personal_info.get('date_of_birth') or personal_info.get('birth_date'),
            'birthdate': personal_info.get('date_of_birth') or personal_info.get('birth_date'),
            # Birth year
            'birth_year': personal_info.get('birth_year'),
            'year': personal_info.get('birth_year'),
            'geburtsjahr': personal_info.get('birth_year'),
            'gender': personal_info.get('gender'),
            'sex': personal_info.get('gender'),
            'geschlecht': personal_info.get('gender'),
            'country': personal_info.get('country'),
            'land': personal_info.get('country'),
            # Standort (location in German)
            'standort': personal_info.get('location') or questions.get('preferred_location'),
            # File uploads - Resume/CV
            'resume': file_paths.get('resume') or file_paths.get('cv'),
            'cv': file_paths.get('resume') or file_paths.get('cv'),
            'lebenslauf': file_paths.get('resume') or file_paths.get('cv'),
            'lebenslauf / cv': file_paths.get('resume') or file_paths.get('cv'),
            'file-upload': file_paths.get('resume') or file_paths.get('cv'),
            'file_app_map': file_paths.get('resume') or file_paths.get('cv'),
            'wbnformextension[]': file_paths.get('resume') or file_paths.get('cv'),
            'wbn-form-extension': file_paths.get('resume') or file_paths.get('cv'),
            # File uploads - Cover letter
            'cover_letter': file_paths.get('cover_letter'),
            'motivationsschreiben': file_paths.get('cover_letter'),
            'anschreiben': file_paths.get('cover_letter'),
            'file_cover_letter': file_paths.get('cover_letter'),
            # File uploads - Photo
            'photo': file_paths.get('photo'),
            'profile': file_paths.get('photo'),
            'profile_picture': file_paths.get('photo'),
            'profile picture': file_paths.get('photo'),
            'foto': file_paths.get('photo'),
            'bild': file_paths.get('photo'),
            'profilbild': file_paths.get('photo'),
            'profil bild': file_paths.get('photo'),
            'file_photo': file_paths.get('photo'),
            'job_experience': personal_info.get('job_experience') or questions.get('job_experience'),
            'professional experience': personal_info.get('job_experience') or questions.get('job_experience'),
            'berufserfahrung': personal_info.get('job_experience') or questions.get('job_experience'),
            'experience': personal_info.get('job_experience') or questions.get('job_experience'),
            'career_levels': talent_pool.get('career_levels') if talent_pool else None,
            'karrierestufe': talent_pool.get('career_levels') if talent_pool else None,
            # Location/City
            'location': personal_info.get('location') or questions.get('preferred_location'),
            'city': personal_info.get('location') or questions.get('preferred_location'),
            'stadt': personal_info.get('location') or questions.get('preferred_location'),
            'ort': personal_info.get('location') or questions.get('preferred_location'),
            'preferred_location': questions.get('preferred_location') or personal_info.get('location'),
            # Address
            'address': personal_info.get('address'),
            'adresse': personal_info.get('address'),
            'street': personal_info.get('street'),
            'straße': personal_info.get('street'),
            'postcode': personal_info.get('postcode'),
            'postal_code': personal_info.get('postcode'),
            'zip': personal_info.get('postcode'),
            'zipcode': personal_info.get('postcode'),
            'postleitzahl': personal_info.get('postcode'),
            'plz': personal_info.get('postcode'),
            # Language knowledge
            'german_knowledge': personal_info.get('german_knowledge'),
            'deutsch': personal_info.get('german_knowledge'),
            'german': personal_info.get('german_knowledge'),
            'german_level': questions.get('german_level') or personal_info.get('german_knowledge'),
            'deutschkenntnisse': questions.get('german_level') or personal_info.get('german_knowledge'),
            'english_knowledge': personal_info.get('english_knowledge'),
            'englisch': personal_info.get('english_knowledge'),
            'english': personal_info.get('english_knowledge'),
            # Education
            'graduation': personal_info.get('graduation'),
            'highest degree': personal_info.get('graduation'),
            'höchster abschluss': personal_info.get('graduation'),
            'höchster_abschluss': personal_info.get('graduation'),
            'degree': personal_info.get('graduation'),
            'abschluss': personal_info.get('graduation'),
            'graduated_as': personal_info.get('graduated_as'),
            'university degree as': personal_info.get('graduated_as'),
            'hochschulabschluss als': personal_info.get('graduated_as'),
            'degree as': personal_info.get('graduated_as'),
            'studienfach': personal_info.get('graduated_as'),
            'vocational_training': personal_info.get('vocational_training'),
            'berufsausbildung': personal_info.get('vocational_training'),
            'vocational training': personal_info.get('vocational_training'),
            # Comments/Cover letter
            'comment': personal_info.get('comment'),
            'kommentar': personal_info.get('comment'),
            'comments': personal_info.get('comment'),
            'cover_letter_text': personal_info.get('comment') or personal_info.get('cover_letter_text'),
            'anschreiben': personal_info.get('comment'),
            # Salary
            'salary': questions.get('salary'),
            'gehalt': questions.get('salary'),
            # Remote work
            'remote_work': questions.get('remote_work'),
            'home_office': questions.get('remote_work'),
            # Start date
            'earliest_start': questions.get('earliest_start'),
            'earliest_start_date': questions.get('earliest_start_date'),
            'start_date': questions.get('earliest_start_date'),
        }
        
        # Talent pool fields (check first)
        if talent_pool:
            talent_pool_mappings = {
                'job_title': talent_pool.get('job_title'),
                'wunschberuf': talent_pool.get('job_title'),
                'location': talent_pool.get('location'),
                'search_geo': talent_pool.get('location'),
                'wunschort': talent_pool.get('location'),
                'radius': talent_pool.get('radius'),
                'geo_radius': talent_pool.get('radius'),
                'salary': talent_pool.get('salary'),
                'gehaltswunsch': talent_pool.get('salary'),
                'salary_currency': talent_pool.get('salary_currency'),
                'salary_type': talent_pool.get('salary_type'),
                'job_time_model': talent_pool.get('job_time_model'),
                'arbeitszeit': talent_pool.get('job_time_model'),
                'job_categories': talent_pool.get('job_categories'),
                'kategorie': talent_pool.get('job_categories'),
                'career_levels': talent_pool.get('career_levels'),
                'karrierestufe': talent_pool.get('career_levels'),
            }
            
            # Check talent pool mappings by name
            if field_name in talent_pool_mappings:
                value = talent_pool_mappings[field_name]
                if value:
                    return value
            
            # Check talent pool mappings by id
            if field_id in talent_pool_mappings:
                value = talent_pool_mappings[field_id]
                if value:
                    return value
            
            # Check talent pool mappings by label
            if label:
                for key, value in talent_pool_mappings.items():
                    if key in label and value:
                        return value
        
        # Check by name
        if field_name in field_mappings:
            value = field_mappings[field_name]
            if value:
                return value
        
        # Check by id
        if field_id in field_mappings:
            value = field_mappings[field_id]
            if value:
                return value
        
        # Check by label (exact match first, then partial match)
        if label:
            lower_label = label.lower().strip()
            # Exact match
            if lower_label in field_mappings:
                value = field_mappings[lower_label]
                if value:
                    return value
            
            # Partial match with word boundaries (to avoid false positives)
            for key, value in field_mappings.items():
                if not value:
                    continue
                # Skip file upload mappings when checking labels (they should only match by name/id)
                if isinstance(value, str) and ('./doc/' in value or '.pdf' in value or '.jpg' in value or '.jpeg' in value):
                    continue
                
                lower_key = key.lower()
                # Exact match
                if lower_label == lower_key:
                    return value
                # Match at word boundaries
                if (lower_label.startswith(lower_key + ' ') or
                    lower_label.endswith(' ' + lower_key) or
                    lower_label.find(' ' + lower_key + ' ') != -1):
                    return value
        
        return None
    
    async def _fill_field_by_info(self, locator, field_info: Dict, value: Any) -> bool:
        """
        Fill a field based on its type
        """
        field_type = field_info.get('type', 'unknown')
        field_name = field_info.get('label') or field_info.get('name') or field_info.get('id') or 'Unknown'
        
        # Build selectors
        selectors = []
        if field_info.get('id'):
            selectors.append(f'#{field_info["id"]}')
        if field_info.get('name'):
            selectors.append(f'[name="{field_info["name"]}"]')
        
        if not selectors:
            return False
        
        try:
            if field_type == 'text' or field_type == 'email' or field_type == 'tel' or field_type == 'textarea':
                return await TextFieldFiller.fill(self.page, selectors, str(value), field_name)
            elif field_type == 'select':
                return await SelectFieldFiller.fill(self.page, selectors, str(value), field_name)
            elif field_type == 'date':
                return await DatePickerFiller.fill(self.page, selectors, str(value), field_name)
            elif field_type == 'file':
                return await FileUploadFiller.fill(self.page, selectors, str(value), field_name)
            elif field_type == 'radio':
                name_selector = f'[name="{field_info["name"]}"]' if field_info.get('name') else selectors[0]
                return await RadioFieldFiller.fill(self.page, name_selector, str(value), field_name)
            elif field_type == 'checkbox':
                return await CheckboxFieldFiller.fill(self.page, selectors, bool(value), field_name)
            else:
                # Try text filler as fallback
                return await TextFieldFiller.fill(self.page, selectors, str(value), field_name)
        except Exception as e:
            print(f'[WARNING] Error filling field {field_name}: {str(e)}')
            return False
    
    async def fill_all_fields(self) -> None:
        """
        Fill all form fields based on configuration
        """
        if not self.page:
            print('[ERROR] No page object available')
            return
        
        personal_info = self.config.get('personal_info', {})
        file_paths = self.config.get('file_paths', {})
        questions = self.config.get('questions', {})
        talent_pool = self.config.get('talent_pool', {})
        
        # Get all form fields sorted by position
        fields = await self._get_form_fields_in_order()
        print(f'\nFound {len(fields)} form fields. Processing in order...\n')
        
        processed_field_names: Set[str] = set()
        
        # Process fields
        for field in fields:
            field_info = await self._get_field_info(field)
            config_value = self._get_config_value_for_field(field_info, personal_info, file_paths, questions, talent_pool)
            
            # Handle talent pool checkbox
            if field_info.get('type') == 'checkbox' and (field_info.get('name') == 'app_register' or field_info.get('id') == 'app_register_btn'):
                if questions.get('talent_pool_enabled') is True:
                    print(f'[OK] Field: "{field_info.get("label") or field_info.get("name")}" (checkbox) - Checking talent pool checkbox')
                    try:
                        checkbox = self.page.locator(f'input[name="{field_info.get("name")}"], input#{field_info.get("id")}').first
                        if await checkbox.count() > 0:
                            is_checked = await checkbox.is_checked()
                            if not is_checked:
                                await checkbox.check()
                                print('[OK] Talent pool checkbox checked')
                                await self.page.wait_for_timeout(2000)
                                await self._fill_talent_pool_fields(talent_pool, processed_field_names)
                    except Exception as e:
                        print(f'[WARNING] Error checking talent pool checkbox: {str(e)}')
            
            field_label = field_info.get('label') or field_info.get('name') or field_info.get('id') or 'Unknown'
            field_type = field_info.get('type') or 'unknown'
            
            if config_value is not None and config_value != '':
                print(f'[OK] Field: "{field_label}" ({field_type}) - Value in config: "{config_value}"')
                await self._fill_field_by_info(field, field_info, config_value)
                
                if field_info.get('name'):
                    processed_field_names.add(field_info['name'])
                if field_info.get('id'):
                    processed_field_names.add(field_info['id'])
                
                # Check for newly visible fields after file upload
                if field_info.get('name') in ['file_app_map', 'file_cover_letter']:
                    print(f'\n[INFO] Checking for newly visible fields after {field_info.get("name")} upload...')
                    await self.page.wait_for_timeout(2000)
                    
                    if file_paths.get('photo') and 'file_photo' not in processed_field_names:
                        try:
                            photo_input = self.page.locator('input[name="file_photo"]').first
                            if await photo_input.count() > 0:
                                is_visible = await photo_input.is_visible()
                                if is_visible:
                                    photo_field_info = await self._get_field_info(photo_input)
                                    photo_config_value = self._get_config_value_for_field(photo_field_info, personal_info, file_paths, questions, talent_pool)
                                    if photo_config_value:
                                        print(f'[OK] Found newly visible photo field: "{photo_field_info.get("label") or photo_field_info.get("name")}" - Value in config: "{photo_config_value}"')
                                        await self._fill_field_by_info(photo_input, photo_field_info, photo_config_value)
                                        processed_field_names.add('file_photo')
                        except Exception:
                            pass
            else:
                print(f'[SKIP] Field: "{field_label}" ({field_type}) - No value in config, skipping')
        
        # Check all visible checkboxes
        await self._check_all_checkboxes(processed_field_names)
        
        print('\n[OK] All fields processed')
    
    async def _check_all_checkboxes(self, processed_field_names: Set[str]) -> None:
        """
        Check all visible checkboxes in the form
        Prioritizes checkboxes with * in label (required fields)
        """
        print('\n[INFO] Checking all visible checkboxes...')
        
        if not self.page:
            return
        
        try:
            all_checkboxes = await self.page.evaluate("""
                () => {
                    const nativeCheckboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
                    const customCheckboxes = Array.from(document.querySelectorAll('[role="checkbox"], [role="switch"]'));
                    const allCb = [...nativeCheckboxes, ...customCheckboxes];
                    const uniqueCb = Array.from(new Set(allCb));
                    
                    return uniqueCb
                        .filter(cb => {
                            const style = window.getComputedStyle(cb);
                            return (
                                style.display !== 'none' &&
                                style.visibility !== 'hidden' &&
                                style.opacity !== '0' &&
                                cb.offsetWidth > 0 &&
                                cb.offsetHeight > 0 &&
                                !cb.disabled &&
                                !cb.readOnly
                            );
                        })
                        .map(cb => {
                            const isChecked = cb.type === 'checkbox' 
                                ? cb.checked 
                                : (cb.getAttribute('aria-checked') === 'true');
                            
                            // Get label text
                            let labelText = '';
                            if (cb.id) {
                                const label = document.querySelector(`label[for="${cb.id}"]`);
                                if (label) labelText = label.textContent?.trim() || '';
                            }
                            if (!labelText) {
                                const parentLabel = cb.closest('label');
                                if (parentLabel) labelText = parentLabel.textContent?.trim() || '';
                            }
                            if (!labelText) {
                                const ariaLabel = cb.getAttribute('aria-label');
                                if (ariaLabel) labelText = ariaLabel;
                            }
                            
                            // Check for * in label or nearby text
                            let hasAsterisk = labelText.includes('*');
                            if (!hasAsterisk) {
                                let parent = cb.parentElement;
                                let depth = 0;
                                while (parent && depth < 5) {
                                    const parentText = parent.textContent || '';
                                    if (parentText.includes('*')) {
                                        hasAsterisk = true;
                                        break;
                                    }
                                    parent = parent.parentElement;
                                    depth++;
                                }
                            }
                            
                            return {
                                name: cb.name || '',
                                id: cb.id || '',
                                checked: isChecked,
                                ariaLabel: cb.getAttribute('aria-label') || '',
                                role: cb.getAttribute('role') || '',
                                isCustom: cb.type !== 'checkbox',
                                label: labelText,
                                hasAsterisk: hasAsterisk
                            };
                        });
                }
            """)
            
            # Sort: required fields (with *) first
            all_checkboxes.sort(key=lambda x: (not x['hasAsterisk'], x['name']))
            
            checked_count = 0
            for checkbox in all_checkboxes:
                label_text = checkbox.get('label', '')
                is_required = checkbox.get('hasAsterisk', False)
                
                # Skip if already processed (unless required)
                if not is_required:
                    if checkbox.get('name') and checkbox['name'] in processed_field_names:
                        continue
                    if checkbox.get('id') and checkbox['id'] in processed_field_names:
                        continue
                
                # Skip if already checked (unless required)
                if checkbox.get('checked') and not is_required:
                    continue
                
                if is_required:
                    print(f'[INFO] Required checkbox (contains *): "{label_text}" - will check it')
                else:
                    print(f'[INFO] Attempting to check: "{label_text}"')
                
                # Build selector
                selectors = []
                if checkbox.get('id'):
                    selectors.append(f'#{checkbox["id"]}')
                if checkbox.get('name'):
                    selectors.append(f'input[name="{checkbox["name"]}"]')
                
                if not selectors:
                    continue
                
                locator = self.page.locator(selectors[0]).first
                if await locator.count() > 0:
                    is_visible = await locator.is_visible()
                    if is_visible:
                        is_checked = False
                        if checkbox.get('isCustom'):
                            aria_checked = await locator.get_attribute('aria-checked')
                            is_checked = aria_checked == 'true'
                        else:
                            is_checked = await locator.is_checked()
                        
                        if not is_checked or is_required:
                            await locator.scroll_into_view_if_needed()
                            await self.page.wait_for_timeout(200)
                            
                            check_success = False
                            
                            if checkbox.get('isCustom'):
                                try:
                                    await locator.click()
                                    await locator.evaluate("""
                                        (el) => {
                                            el.setAttribute('aria-checked', 'true');
                                            const event = new Event('change', { bubbles: true });
                                            el.dispatchEvent(event);
                                        }
                                    """)
                                    check_success = True
                                except Exception:
                                    pass
                            else:
                                try:
                                    await locator.check(force=True)
                                    verified = await locator.is_checked()
                                    if verified:
                                        check_success = True
                                    else:
                                        raise Exception('check() did not change state')
                                except Exception:
                                    try:
                                        await locator.click(force=True)
                                        await self.page.wait_for_timeout(100)
                                        verified = await locator.is_checked()
                                        if verified:
                                            check_success = True
                                        else:
                                            raise Exception('click() did not change state')
                                    except Exception:
                                        try:
                                            await locator.evaluate("""
                                                (el) => {
                                                    el.checked = true;
                                                    const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                                                    el.dispatchEvent(changeEvent);
                                                    const clickEvent = new Event('click', { bubbles: true, cancelable: true });
                                                    el.dispatchEvent(clickEvent);
                                                    const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                                                    el.dispatchEvent(inputEvent);
                                                }
                                            """)
                                            await self.page.wait_for_timeout(100)
                                            verified = await locator.is_checked()
                                            if verified:
                                                check_success = True
                                        except Exception:
                                            pass
                            
                            if check_success or is_required:
                                final_checked = False
                                if checkbox.get('isCustom'):
                                    aria_checked = await locator.get_attribute('aria-checked')
                                    final_checked = aria_checked == 'true'
                                else:
                                    final_checked = await locator.is_checked()
                                
                                if final_checked or is_required:
                                    print(f'[OK] Checked: "{label_text}"')
                                    checked_count += 1
                                    if checkbox.get('name'):
                                        processed_field_names.add(checkbox['name'])
                                    if checkbox.get('id'):
                                        processed_field_names.add(checkbox['id'])
                                    await self.page.wait_for_timeout(500)
            
            print(f'[OK] Checked {checked_count} checkbox(es)')
        except Exception as e:
            print(f'[WARNING] Error checking checkboxes: {str(e)}')
    
    async def _fill_talent_pool_fields(self, talent_pool: Dict, processed_field_names: Set[str]) -> None:
        """
        Fill talent pool fields (career_levels, etc.)
        """
        if not talent_pool or not self.page:
            return
        
        print('\n[INFO] Filling talent pool fields...')
        
        # Handle career_levels (selectize multiple select)
        career_levels = talent_pool.get('career_levels')
        if career_levels and isinstance(career_levels, list) and len(career_levels) > 0:
            try:
                # Try to find selectize input
                selectize_input = self.page.locator('input.selectize-input, .selectize-input input, [class*="selectize"] input').first
                if await selectize_input.count() > 0:
                    is_visible = await selectize_input.is_visible()
                    if is_visible:
                        await selectize_input.scroll_into_view_if_needed()
                        await selectize_input.click()
                        await self.page.wait_for_timeout(500)
                        
                        # Try using selectize API
                        try:
                            selectize_id = await selectize_input.get_attribute('id')
                            if selectize_id:
                                await self.page.evaluate(f"""
                                    (values) => {{
                                        const selectize = $('#{selectize_id}').selectize();
                                        if (selectize && selectize.length > 0) {{
                                            const instance = selectize[0].selectize;
                                            if (instance) {{
                                                values.forEach(val => {{
                                                    instance.setValue(val, true);
                                                }});
                                                instance.trigger('change');
                                            }}
                                        }}
                                    }}
                                """, career_levels)
                                print(f'[OK] Career levels set via selectize API: {career_levels}')
                                await self.page.wait_for_timeout(1000)
                        except Exception:
                            # Fallback: try clicking options in dropdown
                            for value in career_levels:
                                try:
                                    option = self.page.locator(f'.selectize-dropdown [data-value="{value}"], .selectize-dropdown:has-text("{value}")').first
                                    if await option.count() > 0:
                                        await option.click()
                                        await self.page.wait_for_timeout(300)
                                except Exception:
                                    pass
                        
                        # Final fallback: direct selection on hidden select
                        try:
                            hidden_select = self.page.locator('select.selectize').first
                            if await hidden_select.count() > 0:
                                for value in career_levels:
                                    try:
                                        await hidden_select.select_option(value=value)
                                    except Exception:
                                        pass
                        except Exception:
                            pass
            except Exception:
                pass
        
        # Handle other talent pool fields
        for key, value in talent_pool.items():
            if key == 'career_levels':
                continue  # Already handled
            
            if value and value != '':
                try:
                    field = self.page.locator(f'[name="{key}"], #{key}').first
                    if await field.count() > 0:
                        field_info = await self._get_field_info(field)
                        await self._fill_field_by_info(field, field_info, value)
                except Exception:
                    pass
    
    async def _submit_form(self) -> None:
        """
        Submit the form by clicking the bottom-most submit button
        """
        if not self.page:
            return
        
        try:
            # Find all submit-like buttons
            submit_selectors = [
                'button[type="submit"]',
                'input[type="submit"]',
                'button:has-text("Submit")',
                'button:has-text("Absenden")',
                'button:has-text("Senden")',
                'button:has-text("Bewerbung absenden")',
                '[type="submit"]',
                'form button[type="submit"]'
            ]
            
            all_buttons = []
            for selector in submit_selectors:
                buttons = await self.page.locator(selector).all()
                for button in buttons:
                    try:
                        is_visible = await button.is_visible()
                        if is_visible:
                            # Get button text to filter out "Hinzufügen" (Add) buttons
                            button_text = await button.text_content()
                            if button_text and 'hinzufügen' not in button_text.lower() and 'add' not in button_text.lower():
                                # Get position
                                rect = await button.bounding_box()
                                if rect:
                                    all_buttons.append({
                                        'button': button,
                                        'y': rect['y'] + rect['height'],
                                        'text': button_text.strip()
                                    })
                    except Exception:
                        continue
            
            # Also check for <a> tags that act as submit buttons
            link_selectors = [
                'a:has-text("Submit")',
                'a:has-text("Absenden")',
                'a:has-text("Senden")',
                'a[class*="submit"]',
                'a[class*="button"]'
            ]
            
            for selector in link_selectors:
                links = await self.page.locator(selector).all()
                for link in links:
                    try:
                        is_visible = await link.is_visible()
                        if is_visible:
                            link_text = await link.text_content()
                            if link_text and 'hinzufügen' not in link_text.lower():
                                rect = await link.bounding_box()
                                if rect:
                                    all_buttons.append({
                                        'button': link,
                                        'y': rect['y'] + rect['height'],
                                        'text': link_text.strip()
                                    })
                    except Exception:
                        continue
            
            if all_buttons:
                # Sort by vertical position (bottom-most first)
                all_buttons.sort(key=lambda x: x['y'], reverse=True)
                
                # Click the last (bottom-most) button
                submit_button = all_buttons[0]['button']
                button_text = all_buttons[0]['text']
                
                print(f'[INFO] Submitting form with button: "{button_text}"')
                await submit_button.scroll_into_view_if_needed()
                await self.page.wait_for_timeout(500)
                await submit_button.click()
                print('[OK] Form submitted')
                await self.page.wait_for_timeout(3000)
            else:
                print('[WARNING] No submit button found')
        except Exception as e:
            print(f'[WARNING] Error submitting form: {str(e)}')

