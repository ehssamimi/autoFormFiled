# Browser-Use Form Filling Tools

این پروژه برای پر کردن خودکار فرم‌های وب با استفاده از Python و Playwright طراحی شده است.

## نصب Dependencies

```bash
# نصب Playwright
py -3 -m pip install playwright

# نصب مرورگرهای Playwright
py -3 -m playwright install chromium

# نصب سایر dependencies (اختیاری - برای Browser-Use)
py -3 -m pip install browser-use pydantic aiohttp
```

## اجرای مستقیم (بدون Browser-Use)

```bash
cd browser_use
py -3 run_form_fill.py
```

این اسکریپت:
- به URL مشخص شده می‌رود
- Cookie consent را مدیریت می‌کند
- تمام فیلدهای فرم را با داده‌های `config.json` پر می‌کند
- یک screenshot می‌گیرد
- مرورگر را باز می‌گذارد برای بررسی

## استفاده با Browser-Use

```python
from browser_use import Agent
from browser_use.browser_use_form_tools import tools

agent = Agent(
    task="Fill the form",
    tools=tools
)

result = await agent.run("https://example.com/form")
```

## تنظیمات

فایل `config.json` را ویرایش کنید تا داده‌های خود را وارد کنید:

- `personal_info`: اطلاعات شخصی (نام، ایمیل، تلفن، تاریخ تولد، ...)
- `file_paths`: مسیر فایل‌ها (رزومه، کاور لتر، عکس)
- `questions`: پاسخ به سوالات فرم
- `talent_pool`: اطلاعات Talent Pool (در صورت نیاز)

## ساختار فایل‌ها

```
browser_use/
├── run_form_fill.py          # اسکریپت ساده برای اجرا
├── browser_use_form_tools.py # Browser-Use tools
├── config.json               # تنظیمات
├── doc/                      # فایل‌های PDF و عکس
└── modules/                  # ماژول‌های فرم فیلر
    ├── form_filler.py
    ├── text_filler.py
    ├── select_filler.py
    ├── date_picker_filler.py
    ├── file_upload_filler.py
    ├── radio_filler.py
    ├── checkbox_filler.py
    ├── field_detector.py
    └── utils.py
```

## پشتیبانی از فیلدها

- ✅ Text fields (text, email, tel, textarea)
- ✅ Select dropdowns (با value mapping برای gender, country, ...)
- ✅ Date pickers (با calendar interaction)
- ✅ File uploads (با پشتیبانی از span _add strategy)
- ✅ Radio buttons
- ✅ Checkboxes (با اولویت برای required fields)
- ✅ Dynamic fields (فیلدهایی که بعد از تعامل ظاهر می‌شوند)
- ✅ Cookie consent handling
- ✅ URL anchor navigation

## مشکلات رایج

### Playwright نصب نیست
```bash
py -3 -m pip install playwright
py -3 -m playwright install chromium
```

### ModuleNotFoundError
مطمئن شوید که در پوشه `browser_use/` هستید:
```bash
cd browser_use
py -3 run_form_fill.py
```

### فایل‌ها پیدا نمی‌شوند
مسیر فایل‌ها در `config.json` باید نسبت به پوشه `browser_use/` باشد:
```json
{
  "file_paths": {
    "resume": "./doc/resume-sample.pdf",
    "cover_letter": "./doc/Cover-Letter-Sample.pdf",
    "photo": "./doc/profile.jpg"
  }
}
```

