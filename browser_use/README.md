# Browser-Use Form Filling Tools

An advanced web form automation tool built with Python and Playwright that intelligently detects and fills various types of form fields, including custom select implementations, date pickers, file uploads, and more.

## Features

### 🎯 Intelligent Field Detection
- **Standard Fields**: Text, email, tel, textarea, select, radio, checkbox
- **Custom Select Boxes**: 
  - Input text with hidden select elements
  - Combobox buttons with hidden select
  - Bootstrap-select (selectpicker)
  - bw-popover/bw-select-menu custom implementations
- **Date Pickers**: Full calendar interaction (click input, navigate months/years, select day)
- **File Uploads**: 
  - Standard file inputs
  - Dropzone.js implementations
  - Custom upload buttons with hidden inputs

### 🧠 Smart Form Handling
- **Multi-Section Forms**: Automatically scrolls through all sections when important fields (e.g., "Vorname", "Nachname", "email") are detected
- **Dynamic Content**: Waits for dynamically loaded fields with retry mechanisms
- **Error Recovery**: Re-scans form after submission to identify and fix validation errors
- **Interactive Mode**: Prompts user for values when fields are not found in configuration
- **Value Mapping**: Intelligent mapping for common fields (gender, country, language, etc.)

### 🔧 Advanced Capabilities
- Cookie consent handling
- URL anchor navigation
- Field visibility detection
- Required field prioritization
- Smart value matching (exact, partial, case-insensitive)

## Installation

### Prerequisites
```bash
# Install Playwright
py -3 -m pip install playwright

# Install Playwright browsers
py -3 -m playwright install chromium

# Install other dependencies (optional - for Browser-Use integration)
py -3 -m pip install browser-use pydantic aiohttp
```

## Quick Start

### Direct Execution (Standalone)

```bash
cd browser_use
py -3 run_form_fill.py
```

The script will:
1. Navigate to the specified URL
2. Handle cookie consent popups
3. Wait for form elements to load
4. Detect and fill all form fields using data from `config.json`
5. Take a screenshot
6. Submit the form (if auto-submit is enabled)
7. Perform error recovery if validation errors occur
8. Keep browser open for review

### Using with Browser-Use

```python
from browser_use import Agent
from browser_use.browser_use_form_tools import tools

agent = Agent(
    task="Fill the form",
    tools=tools
)

result = await agent.run("https://example.com/form")
```

## Configuration

Edit `config.json` to provide your data:

```json
{
  "personal_info": {
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "phone": "+1234567890",
    "birth_date": "1990-01-15",
    "gender": "male",
    "country": "germany",
    "address": "123 Main St",
    "city": "Berlin",
    "postal_code": "10115"
  },
  "file_paths": {
    "resume": "./doc/resume-sample.pdf",
    "cover_letter": "./doc/Cover-Letter-Sample.pdf",
    "photo": "./doc/profile.jpg"
  },
  "questions": {
    "Why do you want to work here?": "I am passionate about...",
    "What are your strengths?": "Problem-solving, teamwork..."
  },
  "talent_pool": {
    "join_talent_pool": true
  }
}
```

### Supported Value Mappings

The system automatically maps common values:

**Gender/Salutation:**
- `male`, `männlich` → Maps to "Mr", "Herr", "Männlich"
- `female`, `weiblich` → Maps to "Ms", "Frau", "Weiblich"
- `divers`, `diverse` → Maps to "Divers", "Other"

**Country:**
- `germany`, `deutschland` → Maps to "Germany", "Deutschland", "DE"
- `austria`, `österreich` → Maps to "Austria", "Österreich", "AT"
- `iran`, `persia` → Maps to "Iran", "IR"

**Language:**
- `english`, `englisch` → Maps to "Englisch", "English"
- `german`, `deutsch` → Maps to "Deutsch", "German"
- And more...

## Project Structure

```
browser_use/
├── run_form_fill.py          # Main execution script
├── browser_use_form_tools.py # Browser-Use integration tools
├── config.json               # Configuration file
├── doc/                      # Document files (PDFs, images)
└── modules/                   # Form filler modules
    ├── form_filler.py        # Main form filling orchestrator
    ├── text_filler.py        # Text field handling
    ├── select_filler.py      # Select/dropdown handling (with custom implementations)
    ├── date_picker_filler.py # Date picker interaction
    ├── file_upload_filler.py # File upload handling (including Dropzone.js)
    ├── radio_filler.py       # Radio button handling
    ├── checkbox_filler.py    # Checkbox handling
    ├── field_detector.py     # Field type detection
    └── utils.py              # Utility functions
```

## Supported Field Types

### ✅ Standard Fields
- **Text Fields**: `text`, `email`, `tel`, `textarea`
- **Select Dropdowns**: Standard `<select>` elements
- **Radio Buttons**: Single selection from options
- **Checkboxes**: Multiple selections (prioritizes required fields)
- **File Uploads**: Standard `<input type="file">`

### ✅ Custom Select Implementations
- **Custom Select Boxes**: `input[type="text"][data-placeholder]` with hidden `<select>`
- **Combobox Buttons**: `button[role="combobox"]` with hidden `<select>`
- **Bootstrap-Select**: `<select class="selectpicker">` with dropdown menu
- **bw-popover/bw-select-menu**: Custom popover-based select menus

### ✅ Date Pickers
- Full calendar interaction:
  - Clicks input to open calendar
  - Navigates to correct year (via header or arrows)
  - Navigates to correct month (via header or arrows)
  - Selects day from calendar grid
- Supports various date picker libraries (Flatpickr, Air Datepicker, React Datepicker, etc.)

### ✅ File Uploads
- Standard file inputs
- **Dropzone.js**: Detects dropzone containers, clicks to activate, uploads files
- Custom upload buttons with hidden file inputs

### ✅ Advanced Features
- **Dynamic Fields**: Fields that appear after user interaction
- **Multi-Section Forms**: Automatically scans all sections when important fields are detected
- **Error Recovery**: Re-detects and fixes validation errors after submission
- **Cookie Consent**: Automatically handles cookie consent popups
- **URL Anchors**: Navigates to form sections via URL anchors

## How It Works

### 1. Field Detection
The system uses multiple strategies to detect form fields:
- DOM queries for standard elements
- Role-based detection (`role="combobox"`, `role="textbox"`, etc.)
- Class-based detection (custom select implementations)
- Position-based matching for hidden elements

### 2. Value Matching
For select fields, the system:
- Reads all available options
- Matches user-provided values/labels (exact, partial, case-insensitive)
- Uses intelligent value mappings for common fields
- Prompts user interactively if no match is found

### 3. Form Filling
- Scrolls to each field
- Waits for visibility
- Fills using appropriate method for field type
- Verifies successful filling
- Handles errors gracefully

### 4. Error Recovery
After form submission:
- Scans for validation errors (red borders, error messages)
- Re-detects affected fields
- Prompts user for correct values
- Re-fills and re-submits

## Troubleshooting

### Playwright Not Installed
```bash
py -3 -m pip install playwright
py -3 -m playwright install chromium
```

### ModuleNotFoundError
Make sure you're in the `browser_use/` directory:
```bash
cd browser_use
py -3 run_form_fill.py
```

### Files Not Found
File paths in `config.json` should be relative to the `browser_use/` directory:
```json
{
  "file_paths": {
    "resume": "./doc/resume-sample.pdf",
    "cover_letter": "./doc/Cover-Letter-Sample.pdf",
    "photo": "./doc/profile.jpg"
  }
}
```

### Fields Not Detected
- Ensure form elements are visible (not hidden with `display: none`)
- Check browser console for detection logs
- Increase wait times in `run_form_fill.py` if form loads slowly
- Verify field selectors match your form structure

### Select Fields Not Filling
- Check if it's a custom select implementation (bootstrap-select, bw-popover, etc.)
- Verify options are available in the dropdown
- Check browser console for `[SELECT]` or `[BW_SELECT]` logs
- Try providing value in both English and target language (e.g., "male" and "männlich")

### Date Picker Not Working
- Ensure date format in config matches expected format (YYYY-MM-DD)
- Check if calendar opens when clicking the input
- Verify date picker library is supported
- Check browser console for `[DATE_PICKER]` logs

## Advanced Configuration

### Custom Wait Times
Edit `run_form_fill.py` to adjust wait times:
```python
await page.wait_for_timeout(5000)  # Wait 5 seconds
```

### Auto-Submit
Control auto-submission in `run_form_fill.py`:
```python
auto_submit = True  # Set to False to disable auto-submit
```

### Field Detection Logging
The system provides detailed logging:
- `[FIELD_DETECTION]`: Field type detection
- `[SELECT]`: Select field processing
- `[BW_SELECT]`: bw-popover select handling
- `[DATE_PICKER]`: Date picker interaction
- `[FILE_UPLOAD]`: File upload handling
- `[ERROR_RECOVERY]`: Error detection and fixing

## Contributing

When adding support for new field types:
1. Add detection logic in `field_detector.py`
2. Create or update filler module in `modules/`
3. Integrate with `form_filler.py`
4. Add value mappings in `select_filler.py` if needed
5. Update this README

## License

This project is provided as-is for form automation purposes.
