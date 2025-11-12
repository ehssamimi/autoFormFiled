/**
 * File Upload Filler Module
 * Handles file input fields
 */

import { resolve, join } from 'path';
import { existsSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class FileUploadFiller {
    /**
     * Upload a file
     * @param {Object} page - Playwright page object
     * @param {string[]} selectors - List of CSS selectors to try
     * @param {string} filePath - Path to file (relative or absolute)
     * @param {string} fieldName - Field name for logging
     * @returns {Promise<boolean>} True if uploaded successfully
     */
    static async fill(page, selectors, filePath, fieldName = '') {
        console.log(`\n📁 FILE UPLOAD START: ${fieldName}`);
        console.log(`   Selectors: ${JSON.stringify(selectors)}`);
        console.log(`   File path: ${filePath}`);
        
        // Resolve path: if relative, resolve from project root (parent of modules folder)
        let absPath;
        if (filePath.startsWith('./') || filePath.startsWith('../') || !filePath.includes('/') && !filePath.includes('\\')) {
            // Relative path - resolve from project root (parent of modules folder)
            const projectRoot = resolve(__dirname, '..');
            absPath = resolve(projectRoot, filePath);
        } else {
            // Absolute path
            absPath = resolve(filePath);
        }
        
        console.log(`   Absolute path: ${absPath}`);
        
        if (!existsSync(absPath)) {
            console.error(`❌ File not found: ${absPath}`);
            console.error(`   Tried path: ${filePath}`);
            return false;
        }
        
        console.log(`✅ File exists, size: ${statSync(absPath).size} bytes`);
        
        // Strategy 0: Try clicking span with _add suffix FIRST (for finest-jobs.com style)
        for (const selector of selectors) {
            try {
                const nameMatch = selector.match(/name=["']([^"']+)["']/);
                const idMatch = selector.match(/#([\w-]+)/) || selector.match(/id=["']([^"']+)["']/);
                
                if (nameMatch || idMatch) {
                    const name = nameMatch ? nameMatch[1] : null;
                    const id = idMatch ? idMatch[1] : null;
                    
                    // Find text input to get its id
                    let textInputId = id;
                    if (!textInputId && name) {
                        const textInput = page.locator(`input[name="${name}"]`).first();
                        if (await textInput.count() > 0) {
                            textInputId = await textInput.getAttribute('id').catch(() => null);
                        }
                    }
                    
                    if (textInputId) {
                        // Find span with id = textInputId + "_add"
                        const addSpanId = `${textInputId}_add`;
                        const addSpan = page.locator(`span#${addSpanId}`).first();
                        
                        if (await addSpan.count() > 0) {
                            try {
                                // Find file input inside span
                                const fileInputInSpan = addSpan.locator('input[type="file"]').first();
                                
                                if (await fileInputInSpan.count() > 0) {
                                    console.log(`🔍 Found span#${addSpanId} with file input, trying upload...`);
                                    // Scroll to span
                                    await addSpan.scrollIntoViewIfNeeded();
                                    await page.waitForTimeout(200);
                                    
                                    // Click the span first (some uploaders need this)
                                    try {
                                        await addSpan.click({ timeout: 2000 });
                                        await page.waitForTimeout(300);
                                    } catch (e) {
                                        // Ignore if click fails
                                    }
                                    
                                    // Set the file
                                    try {
                                        await fileInputInSpan.setInputFiles(absPath, { timeout: 10000 });
                                        
                                        // Trigger change event
                                        await fileInputInSpan.evaluate((input) => {
                                            const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                                            input.dispatchEvent(changeEvent);
                                        });
                                        
                                        // Also trigger on span
                                        await addSpan.evaluate((span) => {
                                            const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                                            span.dispatchEvent(changeEvent);
                                        });
                                        
                                        console.log(`✅ ${fieldName || 'File'}: uploaded '${absPath.split(/[/\\]/).pop()}' (via span _add click)`);
                                        await page.waitForTimeout(2000);
                                        
                                        // Verify file was set
                                        const fileCount = await fileInputInSpan.evaluate((input) => {
                                            return input.files ? input.files.length : 0;
                                        }).catch(() => 0);
                                        
                                        if (fileCount > 0) {
                                            return true;
                                        }
                                    } catch (setError) {
                                        console.log(`⚠️  Error setting file in span: ${setError.message}`);
                                    }
                                }
                            } catch (error) {
                                // Continue
                            }
                        }
                    }
                }
            } catch (error) {
                continue;
            }
        }
        
        // Strategy 1: Try to find the actual file input (even if hidden)
        for (const selector of selectors) {
            console.log(`\n🔍 Trying selector: ${selector}`);
            try {
                // First, try to find file input by name or id
                const nameMatch = selector.match(/name=["']([^"']+)["']/);
                const idMatch = selector.match(/#([\w-]+)/) || selector.match(/id=["']([^"']+)["']/);
                
                if (nameMatch) {
                    const name = nameMatch[1];
                    
                    // Step 1: Try to find file input with this name directly
                    const fileInput = page.locator(`input[type="file"][name="${name}"]`).first();
                    if (await fileInput.count() > 0) {
                        try {
                            await fileInput.setInputFiles(absPath);
                            console.log(`✅ ${fieldName || 'File'}: uploaded '${absPath.split(/[/\\]/).pop()}' (by name)`);
                            await page.waitForTimeout(500);
                            return true;
                        } catch (error) {
                            // Continue to next strategy
                        }
                    }
                    
                    // Step 2: Find text input with this name, get its id, then find file input in span with _add
                    const textInput = page.locator(`input[name="${name}"]`).first();
                    if (await textInput.count() > 0) {
                        const textInputId = await textInput.getAttribute('id').catch(() => null);
                        if (textInputId) {
                            console.log(`🔍 Found text input with id: ${textInputId}, looking for file input in span with id: ${textInputId}_add`);
                            
                            // Find span with id = textInputId + "_add"
                            const addSpanId = `${textInputId}_add`;
                            const addSpan = page.locator(`span[id="${addSpanId}"] input[type="file"]`).first();
                            const addSpanCount = await addSpan.count().catch(() => 0);
                            console.log(`🔍 File input in span selector count: ${addSpanCount}`);
                            
                            if (addSpanCount > 0) {
                                try {
                                    // Scroll to the file input to make sure it's visible
                                    await addSpan.scrollIntoViewIfNeeded();
                                    await page.waitForTimeout(200);
                                    
                                    // IMPORTANT: Make sure the file input is actually visible/accessible
                                    const isFileInputVisible = await addSpan.isVisible().catch(() => false);
                                    console.log(`   File input visible: ${isFileInputVisible}`);
                                    
                                    // Try clicking the file input first (some custom uploaders need this)
                                    try {
                                        await addSpan.click({ timeout: 1000 });
                                        await page.waitForTimeout(300);
                                    } catch (e) {
                                        // Ignore if click fails
                                    }
                                    
                                    // Set the file - try with force option for hidden inputs
                                    try {
                                        await addSpan.setInputFiles(absPath, { timeout: 5000 });
                                        console.log(`✅ File set in input`);
                                    } catch (setError) {
                                        console.log(`⚠️  Error setting file (first attempt): ${setError.message}`);
                                        // Try alternative: use evaluate to set files directly
                                        try {
                                            await addSpan.evaluate((input, filePath) => {
                                                // Create a File object (this won't work in browser context, but worth trying)
                                                // Actually, we need to use DataTransfer API
                                                const dataTransfer = new DataTransfer();
                                                // Note: We can't create File from path in browser, so this won't work
                                                // But we can try to trigger the file input dialog
                                                input.click();
                                            }, absPath);
                                            // Then try setInputFiles again
                                            await addSpan.setInputFiles(absPath, { timeout: 5000 });
                                            console.log(`✅ File set in input (after click)`);
                                        } catch (retryError) {
                                            console.log(`❌ Failed to set file after retry: ${retryError.message}`);
                                            throw setError; // Re-throw original error
                                        }
                                    }
                                    
                                    // Wait a bit for the file to be processed
                                    await page.waitForTimeout(500);
                                    
                                    // Verify file was set BEFORE triggering events
                                    const filesBeforeEvent = await addSpan.evaluate((input) => {
                                        return input.files ? input.files.length : 0;
                                    }).catch(() => 0);
                                    console.log(`   Files count before events: ${filesBeforeEvent}`);
                                    
                                    // Trigger change event on the file input (some custom uploaders need this)
                                    await addSpan.evaluate((input) => {
                                        // Try multiple event types
                                        const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                                        input.dispatchEvent(changeEvent);
                                        
                                        const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                                        input.dispatchEvent(inputEvent);
                                        
                                        // Also try FileList change simulation
                                        if (input.files && input.files.length > 0) {
                                            const fileListEvent = new Event('change', { bubbles: true, cancelable: true });
                                            Object.defineProperty(fileListEvent, 'target', { value: input, enumerable: true });
                                            input.dispatchEvent(fileListEvent);
                                        }
                                    }).catch((e) => {
                                        console.log(`   Error in file input event: ${e.message}`);
                                    });
                                    
                                    // Also trigger on the text input (for custom upload handlers)
                                    await textInput.evaluate((input) => {
                                        const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                                        input.dispatchEvent(changeEvent);
                                        
                                        const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                                        input.dispatchEvent(inputEvent);
                                    }).catch((e) => {
                                        console.log(`   Error in text input event: ${e.message}`);
                                    });
                                    
                                    // Additional: Try to trigger any custom handlers
                                    await page.evaluate((inputId) => {
                                        // Look for any custom upload handlers
                                        const textInput = document.getElementById(inputId);
                                        if (textInput) {
                                            // Try to find and trigger any associated handlers
                                            const form = textInput.closest('form');
                                            if (form) {
                                                // Trigger form-level events
                                                const formEvent = new Event('change', { bubbles: true });
                                                form.dispatchEvent(formEvent);
                                            }
                                        }
                                    }, textInputId).catch(() => {});
                                    
                                    console.log(`✅ ${fieldName || 'File'}: uploaded '${absPath.split(/[/\\]/).pop()}' (found via text input id)`);
                                    
                                    // Wait for upload to process and check if text input is updated
                                    await page.waitForTimeout(3000);
                                    
                                    // Verify file was actually set
                                    const fileInputFiles = await addSpan.evaluate((input) => {
                                        return input.files ? input.files.length : 0;
                                    }).catch(() => 0);
                                    console.log(`   File input files count: ${fileInputFiles}`);
                                    
                                    if (fileInputFiles > 0) {
                                        const fileName = await addSpan.evaluate((input) => {
                                            return input.files && input.files[0] ? input.files[0].name : '';
                                        }).catch(() => '');
                                        console.log(`   File name in input: "${fileName}"`);
                                    }
                                    
                                    // Check if the text input shows the file name
                                    const textInputValue = await textInput.inputValue().catch(() => '');
                                    console.log(`   Text input value after upload: "${textInputValue}"`);
                                    
                                    // Check if preview image is shown (indicates successful upload)
                                    const previewImg = page.locator(`img#${textInputId}_preview`).first();
                                    const previewVisible = await previewImg.isVisible().catch(() => false);
                                    console.log(`   Preview image visible: ${previewVisible}`);
                                    
                                    // Additional verification: Check if any visual indicator appears
                                    const uploadIndicators = await page.evaluate((inputId) => {
                                        const indicators = [];
                                        // Check for common upload success indicators
                                        const successSelectors = [
                                            `[id*="${inputId}"] .success`,
                                            `[id*="${inputId}"] .uploaded`,
                                            `[id*="${inputId}"] .file-name`,
                                            `[id*="${inputId}"] .file-info`
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
                                    }, textInputId).catch(() => []);
                                    
                                    if (uploadIndicators.length > 0) {
                                        console.log(`   Upload indicators found: ${uploadIndicators.join(', ')}`);
                                    }
                                    
                                    // Final verification
                                    if (fileInputFiles > 0 || textInputValue || previewVisible || uploadIndicators.length > 0) {
                                        console.log(`   ✅ Upload verification: PASSED`);
                                        return true;
                                    } else {
                                        console.log(`   ⚠️  Upload verification: UNCLEAR - file may not be properly uploaded`);
                                        // Still return true as file was set, but warn user
                                        return true;
                                    }
                                } catch (error) {
                                    console.log(`⚠️  Error setting file in span: ${error.message}`);
                                    console.log(`   Error stack: ${error.stack}`);
                                    // Continue
                                }
                            }
                            
                            // Alternative: Find span with id ending in _add that contains file input
                            const addSpanAlt = page.locator(`span[id="${addSpanId}"]`).first();
                            const addSpanAltCount = await addSpanAlt.count().catch(() => 0);
                            console.log(`🔍 Span with id "${addSpanId}" count: ${addSpanAltCount}`);
                            
                            if (addSpanAltCount > 0) {
                                const fileInputInSpan = addSpanAlt.locator('input[type="file"]').first();
                                const fileInputCount = await fileInputInSpan.count().catch(() => 0);
                                console.log(`🔍 File input inside span count: ${fileInputCount}`);
                                
                                if (fileInputCount > 0) {
                                    try {
                                        await fileInputInSpan.setInputFiles(absPath);
                                        console.log(`✅ ${fieldName || 'File'}: uploaded '${absPath.split(/[/\\]/).pop()}' (in span by id)`);
                                        await page.waitForTimeout(1000);
                                        return true;
                                    } catch (error) {
                                        console.log(`⚠️  Error setting file in span (alt): ${error.message}`);
                                        // Continue
                                    }
                                }
                            }
                        }
                    }
                }
                
                if (idMatch) {
                    const id = idMatch[1];
                    
                    // Try to find file input near this id (in span with _add suffix)
                    const addSpanId = `${id}_add`;
                    const addSpan = page.locator(`span[id="${addSpanId}"] input[type="file"]`).first();
                    if (await addSpan.count() > 0) {
                        try {
                            await addSpan.setInputFiles(absPath);
                            console.log(`✅ ${fieldName || 'File'}: uploaded '${absPath.split(/[/\\]/).pop()}' (by id span)`);
                            await page.waitForTimeout(500);
                            return true;
                        } catch (error) {
                            // Continue
                        }
                    }
                }
                
                // Strategy 2: Try original selector (might be text input, find file input nearby)
                const locator = page.locator(selector).first();
                const count = await locator.count().catch(() => 0);
                
                if (count > 0) {
                    // Check if it's already a file input
                    const inputType = await locator.getAttribute('type').catch(() => null);
                    if (inputType === 'file') {
                        try {
                            await locator.setInputFiles(absPath);
                            console.log(`✅ ${fieldName || 'File'}: uploaded '${absPath.split(/[/\\]/).pop()}'`);
                            await page.waitForTimeout(500);
                            return true;
                        } catch (error) {
                            // Continue
                        }
                    } else {
                        // It's a text input, find the file input in the same container
                        try {
                            // Find file input in parent or nearby
                            const fileInputNearby = locator.locator('xpath=ancestor::*//input[@type="file"]').first();
                            if (await fileInputNearby.count() > 0) {
                                await fileInputNearby.setInputFiles(absPath);
                                console.log(`✅ ${fieldName || 'File'}: uploaded '${absPath.split(/[/\\]/).pop()}' (nearby)`);
                                await page.waitForTimeout(500);
                                return true;
                            }
                        } catch (error) {
                            // Continue
                        }
                    }
                }
            } catch (error) {
                continue;
            }
        }
        
        // Strategy 3: Try to find any file input with matching name attribute
        try {
            // Extract name from selectors
            for (const selector of selectors) {
                const nameMatch = selector.match(/name=["']([^"']+)["']/);
                if (nameMatch) {
                    const name = nameMatch[1];
                    // Find all file inputs and check if any has this name
                    const allFileInputs = await page.locator('input[type="file"]').all();
                    for (const fileInput of allFileInputs) {
                        const fileInputName = await fileInput.getAttribute('name').catch(() => null);
                        if (fileInputName === name) {
                            try {
                                await fileInput.setInputFiles(absPath);
                                console.log(`✅ ${fieldName || 'File'}: uploaded '${absPath.split(/[/\\]/).pop()}' (by name search)`);
                                await page.waitForTimeout(500);
                                return true;
                            } catch (error) {
                                // Continue
                            }
                        }
                    }
                }
            }
        } catch (error) {
            // Ignore
        }
        
        // Strategy 4: Try clicking span with _add suffix and then setting file (for finest-jobs.com style)
        for (const selector of selectors) {
            try {
                const nameMatch = selector.match(/name=["']([^"']+)["']/);
                const idMatch = selector.match(/#([\w-]+)/) || selector.match(/id=["']([^"']+)["']/);
                
                if (nameMatch || idMatch) {
                    const name = nameMatch ? nameMatch[1] : null;
                    const id = idMatch ? idMatch[1] : null;
                    
                    // Find text input to get its id
                    let textInputId = id;
                    if (!textInputId && name) {
                        const textInput = page.locator(`input[name="${name}"]`).first();
                        if (await textInput.count() > 0) {
                            textInputId = await textInput.getAttribute('id').catch(() => null);
                        }
                    }
                    
                    if (textInputId) {
                        // Find span with id = textInputId + "_add"
                        const addSpanId = `${textInputId}_add`;
                        const addSpan = page.locator(`span#${addSpanId}`).first();
                        
                        if (await addSpan.count() > 0) {
                            try {
                                // Find file input inside span
                                const fileInputInSpan = addSpan.locator('input[type="file"]').first();
                                
                                if (await fileInputInSpan.count() > 0) {
                                    // Scroll to span
                                    await addSpan.scrollIntoViewIfNeeded();
                                    await page.waitForTimeout(200);
                                    
                                    // Click the span first (some uploaders need this)
                                    try {
                                        await addSpan.click({ timeout: 2000 });
                                        await page.waitForTimeout(300);
                                    } catch (e) {
                                        // Ignore if click fails
                                    }
                                    
                                    // Set the file
                                    try {
                                        await fileInputInSpan.setInputFiles(absPath, { timeout: 10000 });
                                        
                                        // Trigger change event
                                        await fileInputInSpan.evaluate((input) => {
                                            const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                                            input.dispatchEvent(changeEvent);
                                        });
                                        
                                        // Also trigger on span
                                        await addSpan.evaluate((span) => {
                                            const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                                            span.dispatchEvent(changeEvent);
                                        });
                                        
                                        console.log(`✅ ${fieldName || 'File'}: uploaded '${absPath.split(/[/\\]/).pop()}' (via span _add click)`);
                                        await page.waitForTimeout(2000);
                                        
                                        // Verify file was set
                                        const fileCount = await fileInputInSpan.evaluate((input) => {
                                            return input.files ? input.files.length : 0;
                                        }).catch(() => 0);
                                        
                                        if (fileCount > 0) {
                                            return true;
                                        }
                                    } catch (setError) {
                                        console.log(`⚠️  Error setting file in span: ${setError.message}`);
                                    }
                                }
                            } catch (error) {
                                // Continue
                            }
                        }
                    }
                }
            } catch (error) {
                continue;
            }
        }
        
        // Strategy 5: Try drag-and-drop zone
        try {
            // Look for dropzone containers
            const dropzoneSelectors = [
                '.dropzone',
                '[class*="dropzone"]',
                '[class*="drop-zone"]',
                '[class*="file-drop"]',
                '[data-dropzone]',
                '[id*="dropzone"]',
                '[id*="drop-zone"]'
            ];
            
            for (const dropzoneSelector of dropzoneSelectors) {
                try {
                    const dropzone = page.locator(dropzoneSelector).first();
                    if (await dropzone.count() > 0) {
                        const isVisible = await dropzone.isVisible().catch(() => false);
                        if (isVisible) {
                            // Find hidden file input inside dropzone
                            const fileInput = dropzone.locator('input[type="file"]').first();
                            if (await fileInput.count() > 0) {
                                await fileInput.setInputFiles(absPath);
                                console.log(`✅ ${fieldName || 'File'}: uploaded '${absPath.split(/[/\\]/).pop()}' (drag-and-drop zone)`);
                                await page.waitForTimeout(500);
                                return true;
                            }
                        }
                    }
                } catch (error) {
                    continue;
                }
            }
        } catch (error) {
            // Ignore
        }
        
        console.log(`⚠️  ${fieldName || 'File upload field'} not found`);
        return false;
    }
}

