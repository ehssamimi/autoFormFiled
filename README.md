# Automated Web Form Filler

A comprehensive web form automation tool with support for both **Node.js/JavaScript** and **Python** implementations. Automatically fills web forms using Playwright browser automation with intelligent field detection and handling.

## 🚀 Quick Start

This project contains two implementations:

### Python Implementation (Recommended)
**Location**: `browser_use/` directory

The Python version is the most advanced and feature-rich implementation. See [`browser_use/README.md`](./browser_use/README.md) for complete documentation.

**Key Features:**
- ✅ Intelligent field detection (standard and custom implementations)
- ✅ Support for custom select boxes (bootstrap-select, bw-popover, combobox)
- ✅ Full date picker interaction with calendar navigation
- ✅ Dropzone.js file upload support
- ✅ Multi-section form scanning
- ✅ Error recovery and validation handling
- ✅ Interactive mode for missing values
- ✅ Smart value mapping for common fields

**Quick Start:**
```bash
cd browser_use
py -3 -m pip install playwright
py -3 -m playwright install chromium
py -3 run_form_fill.py
```

For detailed documentation, configuration, and advanced features, see: **[`browser_use/README.md`](./browser_use/README.md)**

---

### JavaScript/Node.js Implementation
**Location**: Root directory

A simpler JavaScript implementation using Node.js and Playwright.

## Features (JavaScript Version)

- ✅ Automatically fills text fields (name, email, phone, etc.)
- ✅ Handles dropdown selections
- ✅ Uploads files (resume, cover letter, etc.)
- ✅ Supports multiple selector strategies for maximum compatibility
- ✅ Takes screenshots for verification
- ✅ Configurable via JSON file
- ✅ Error handling and logging
- ✅ Fast and efficient with modern JavaScript

## Installation (JavaScript Version)

### Prerequisites

- Node.js (v16 or higher recommended)
- npm or yarn

### 1. Install Dependencies

```bash
npm install
```

### 2. Install Playwright Browsers

```bash
npm run install-browsers
```

Or install all browsers:
```bash
npx playwright install
```

## Configuration (JavaScript Version)

Edit `config.json` to set your form data:

```json
{
  "personal_info": {
    "first_name": "Your First Name",
    "last_name": "Your Last Name",
    "birth_year": "1990",
    "email": "your.email@example.com",
    "phone": "09123456789",
    "address": "Your Address"
  },
  "file_paths": {
    "resume": "./resume.pdf",
    "cover_letter": "./cover_letter.pdf"
  },
  "settings": {
    "headless": false,
    "wait_timeout": 3000,
    "screenshot_on_error": true
  }
}
```

### Settings Explained

- `headless`: Run browser in background (true) or visible (false)
- `wait_timeout`: Time to wait after page load (milliseconds)
- `screenshot_on_error`: Take screenshot when errors occur

## Usage (JavaScript Version)

### Basic Usage

```bash
npm start
```

Or directly:
```bash
node formFiller.js
```

### Custom URL

Edit the `url` variable in `formFiller.js`:

```javascript
const url = 'https://example.com/form';
await filler.fillForm(url, false);
```

### Auto Submit

To automatically submit the form after filling:

```javascript
await filler.fillForm(url, true);
```

## Finding Form Field Selectors

To customize selectors for specific forms:

1. Open the form page in a browser
2. Press F12 to open Developer Tools
3. Right-click on a form field and select "Inspect"
4. Note the field's `name`, `id`, or other attributes
5. Add custom selectors to the `_fillAllFields()` method in `formFiller.js`

Example selectors:
- `input[name='firstname']` - Input with name attribute
- `input[id='email']` - Input with id attribute
- `input[type='email']` - Input by type
- `select[name='country']` - Dropdown select

## File Structure

```
form_complete/
├── browser_use/              # Python implementation (RECOMMENDED)
│   ├── README.md            # Complete Python documentation
│   ├── run_form_fill.py     # Main Python script
│   ├── config.json          # Python configuration
│   └── modules/             # Python modules
│       ├── form_filler.py
│       ├── select_filler.py
│       ├── date_picker_filler.py
│       └── ...
├── formFiller.js            # JavaScript implementation
├── package.json             # Node.js dependencies
├── config.json             # JavaScript configuration
├── modules/                # JavaScript modules
│   ├── FieldFiller.js
│   ├── SelectFieldFiller.js
│   └── ...
└── README.md               # This file
```

## Which Version Should I Use?

### Use Python Version (`browser_use/`) if you need:
- ✅ Support for custom select implementations (bootstrap-select, bw-popover, etc.)
- ✅ Advanced date picker interaction
- ✅ Dropzone.js file upload support
- ✅ Multi-section form scanning
- ✅ Error recovery after form submission
- ✅ Interactive mode for missing values
- ✅ Smart value mapping

### Use JavaScript Version if you need:
- ✅ Simple, straightforward form filling
- ✅ Node.js ecosystem integration
- ✅ Quick setup with npm

**💡 Recommendation**: For most use cases, especially complex forms with custom implementations, use the **Python version** in `browser_use/` directory.

## Troubleshooting

### Field Not Found

If a field is not being filled:
1. Check the browser console for errors
2. Verify the selector matches the actual HTML
3. Add custom selectors to the selector list
4. Check if the field is inside an iframe (needs special handling)

### File Upload Issues

- Ensure file paths in `config.json` are correct
- Use absolute paths for better reliability
- Check file size limits on the target website

### Timeout Errors

- Increase `wait_timeout` in `config.json`
- Check your internet connection
- Some sites may have anti-bot protection

### Module Not Found

**JavaScript:**
```bash
npm install
```

**Python:**
```bash
cd browser_use
py -3 -m pip install playwright
py -3 -m playwright install chromium
```

### Playwright Browser Not Found

**JavaScript:**
```bash
npx playwright install chromium
```

**Python:**
```bash
py -3 -m playwright install chromium
```

## Advanced Usage (JavaScript Version)

### Programmatic Usage

```javascript
import { FormFiller } from './formFiller.js';

async function fillCustomForm() {
    const filler = new FormFiller('config.json');
    await filler.fillForm('https://example.com/form', true);
}

fillCustomForm().catch(console.error);
```

### Multiple Forms

```javascript
const urls = [
    'https://site1.com/form',
    'https://site2.com/form',
    'https://site3.com/form'
];

const filler = new FormFiller('config.json');

for (const url of urls) {
    await filler.fillForm(url, false);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait between forms
}
```

### Custom Selectors

You can modify the `_fillAllFields()` method to add custom selectors for specific forms:

```javascript
// Add custom field
await this._fillField(
    ['input[name="custom_field"]', 'input[id="custom"]'],
    'Custom Value',
    'Custom Field'
);
```

## Security Notes

- Never commit `config.json` with real personal data to version control
- Use environment variables for sensitive information
- Review forms before auto-submitting
- Be aware of website terms of service regarding automation
- The `.gitignore` file already excludes `config.json` from version control

## Performance Tips

- Use `headless: true` for faster execution
- Adjust `wait_timeout` based on page load speed
- Use specific selectors instead of generic ones for better performance

## Documentation

- **Python Implementation**: See [`browser_use/README.md`](./browser_use/README.md) for complete documentation, advanced features, and configuration options.
- **JavaScript Implementation**: See code comments in `formFiller.js` and module files.

## License

This project is for educational and personal use only.

## Support

For issues or questions:
1. **Python version**: Check [`browser_use/README.md`](./browser_use/README.md) for detailed documentation
2. **JavaScript version**: Check the code comments in `formFiller.js`
3. Modify selectors based on your specific form structure
4. Check Playwright documentation: https://playwright.dev/
