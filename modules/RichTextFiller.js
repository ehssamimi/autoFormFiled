/**
 * Rich Text Editor Filler Module
 * Handles WYSIWYG editors (TinyMCE, CKEditor, Quill, contentEditable divs)
 */

export class RichTextFiller {
    /**
     * Fill a rich text editor field
     * @param {Object} page - Playwright page object
     * @param {string[]} selectors - List of CSS selectors to try
     * @param {string} value - HTML or plain text to fill
     * @param {string} fieldName - Field name for logging
     * @returns {Promise<boolean>} True if filled successfully
     */
    static async fill(page, selectors, value, fieldName = '') {
        for (const selector of selectors) {
            try {
                // Strategy 1: Try TinyMCE
                try {
                    const success = await page.evaluate((sel, val) => {
                        // Try to find TinyMCE editor
                        if (typeof tinymce !== 'undefined') {
                            const editors = tinymce.get();
                            for (const editor of editors) {
                                if (editor.getContainer().querySelector(sel) || editor.id === sel.replace('#', '')) {
                                    editor.setContent(val);
                                    return true;
                                }
                            }
                        }
                        return false;
                    }, selector, value);
                    
                    if (success) {
                        await page.waitForTimeout(200);
                        console.log(`✅ ${fieldName || selector}: '${value.substring(0, 50)}...' (TinyMCE)`);
                        return true;
                    }
                } catch (error) {
                    // Continue
                }
                
                // Strategy 2: Try CKEditor
                try {
                    const success = await page.evaluate((sel, val) => {
                        if (typeof CKEDITOR !== 'undefined') {
                            for (const name in CKEDITOR.instances) {
                                const editor = CKEDITOR.instances[name];
                                if (editor.element && (editor.element.$ === document.querySelector(sel) || editor.name === sel.replace('#', ''))) {
                                    editor.setData(val);
                                    return true;
                                }
                            }
                        }
                        return false;
                    }, selector, value);
                    
                    if (success) {
                        await page.waitForTimeout(200);
                        console.log(`✅ ${fieldName || selector}: '${value.substring(0, 50)}...' (CKEditor)`);
                        return true;
                    }
                } catch (error) {
                    // Continue
                }
                
                // Strategy 3: Try Quill
                try {
                    const locator = page.locator(selector).first();
                    if (await locator.count() > 0) {
                        const success = await page.evaluate((sel, val) => {
                            const element = document.querySelector(sel);
                            if (element) {
                                // Try to find Quill instance
                                const quillContainer = element.closest('.ql-container') || element;
                                if (quillContainer.__quill) {
                                    quillContainer.__quill.root.innerHTML = val;
                                    return true;
                                }
                                // Try by class
                                const quillEditor = document.querySelector(`${sel} .ql-editor`);
                                if (quillEditor) {
                                    quillEditor.innerHTML = val;
                                    return true;
                                }
                            }
                            return false;
                        }, selector, value);
                        
                        if (success) {
                            await page.waitForTimeout(200);
                            console.log(`✅ ${fieldName || selector}: '${value.substring(0, 50)}...' (Quill)`);
                            return true;
                        }
                    }
                } catch (error) {
                    // Continue
                }
                
                // Strategy 4: Try contentEditable div
                try {
                    const locator = page.locator(selector).first();
                    if (await locator.count() > 0) {
                        await locator.scrollIntoViewIfNeeded();
                        await locator.click();
                        await page.waitForTimeout(100);
                        
                        // Clear existing content
                        await locator.evaluate(el => {
                            el.innerHTML = '';
                        });
                        
                        // Set content
                        await locator.evaluate((el, val) => {
                            el.innerHTML = val;
                            // Trigger input event
                            const event = new Event('input', { bubbles: true });
                            el.dispatchEvent(event);
                        }, value);
                        
                        await page.waitForTimeout(200);
                        const content = await locator.textContent();
                        if (content && content.includes(value.substring(0, 20))) {
                            console.log(`✅ ${fieldName || selector}: '${value.substring(0, 50)}...' (contentEditable)`);
                            return true;
                        }
                    }
                } catch (error) {
                    // Continue
                }
                
                // Strategy 5: Try iframe (WYSIWYG editors often use iframes)
                try {
                    const iframe = page.locator(selector).first();
                    if (await iframe.count() > 0) {
                        const frame = await iframe.contentFrame();
                        if (frame) {
                            const body = frame.locator('body');
                            if (await body.count() > 0) {
                                await body.click();
                                await page.waitForTimeout(100);
                                await body.evaluate((el, val) => {
                                    el.innerHTML = val;
                                    const event = new Event('input', { bubbles: true });
                                    el.dispatchEvent(event);
                                }, value);
                                await page.waitForTimeout(200);
                                console.log(`✅ ${fieldName || selector}: '${value.substring(0, 50)}...' (iframe)`);
                                return true;
                            }
                        }
                    }
                } catch (error) {
                    // Continue
                }
            } catch (error) {
                continue;
            }
        }
        
        return false;
    }
}

