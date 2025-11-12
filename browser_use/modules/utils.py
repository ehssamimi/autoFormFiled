"""
Utility functions for form filling
"""

import os
import re
from pathlib import Path


def normalize_date(date_value: str) -> str:
    """
    Normalize date to YYYY-MM-DD format
    """
    if not date_value:
        return ''
    
    # Already in YYYY-MM-DD format
    if re.match(r'^\d{4}-\d{2}-\d{2}$', date_value):
        return date_value
    
    # DD.MM.YYYY format
    if re.match(r'^\d{2}\.\d{2}\.\d{4}$', date_value):
        parts = date_value.split('.')
        return f"{parts[2]}-{parts[1]}-{parts[0]}"
    
    # YYYY format only
    if re.match(r'^\d{4}$', date_value):
        return f"{date_value}-01-01"
    
    # Try parsing as date
    try:
        from datetime import datetime
        date = datetime.strptime(date_value, '%Y-%m-%d')
        return date.strftime('%Y-%m-%d')
    except:
        pass
    
    return date_value


def resolve_file_path(file_path: str, base_dir: str = None) -> str:
    """
    Resolve file path (relative or absolute)
    """
    if not file_path:
        return ''
    
    # If absolute path, return as is
    if os.path.isabs(file_path):
        return file_path
    
    # If relative path, resolve from base_dir or current directory
    if base_dir:
        base = Path(base_dir)
    else:
        base = Path(__file__).parent.parent
    
    resolved = base / file_path
    return str(resolved.resolve())


def get_date_formats(year: str, month: str, day: str) -> list:
    """
    Get common date formats
    """
    day_num = int(day)
    month_num = int(month)
    
    return [
        f"{day_num}.{month_num}.{year}",  # DD.MM.YYYY
        f"{day}.{month}.{year}",          # DD.MM.YYYY (with zeros)
        f"{year}-{month}-{day}",          # YYYY-MM-DD
    ]


def validate_date(current_value: str, expected_date: str, year: str, month: str, day: str) -> bool:
    """
    Validate if the filled date matches expected date
    """
    if not current_value or len(current_value) == 0:
        return False
    
    # Normalize current value
    normalized_current = normalize_date(current_value)
    if normalized_current == expected_date:
        return True
    
    # Check if year, month, and day match
    parts = normalized_current.split('-')
    if len(parts) == 3:
        current_year, current_month, current_day = parts
        if current_year == year and current_month == month and current_day == day:
            return True
    
    # Check common date formats
    day_num = int(day)
    month_num = int(month)
    
    # DD.MM.YYYY format
    if f"{day_num}.{month_num}.{year}" in current_value or f"{day}.{month}.{year}" in current_value:
        return True
    
    # DD/MM/YYYY format
    if f"{day_num}/{month_num}/{year}" in current_value or f"{day}/{month}/{year}" in current_value:
        return True
    
    return False

