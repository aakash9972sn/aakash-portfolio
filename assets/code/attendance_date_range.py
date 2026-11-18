"""Date-range example adapted from the Smart ID report, section 12.2.
Run: python attendance_date_range.py
Synthetic timestamps, not hardware measurements.
"""
from datetime import datetime, timedelta, timezone

# Fixed India Standard Time offset; no third-party packages required.
IST = timezone(timedelta(hours=5, minutes=30))

def timestamp(value):
    parsed = datetime.fromisoformat(value)
    return parsed.replace(tzinfo=IST) if parsed.tzinfo is None else parsed.astimezone(IST)

def time_in_range(entry, exit, start, end):
    if exit <= entry:
        raise ValueError("Invalid session")
    if end <= start:
        raise ValueError("Invalid reporting range")
    overlap_start = max(entry, start)
    overlap_end = min(exit, end)
    return max(timedelta(0), overlap_end - overlap_start)

if __name__ == "__main__":
    entry = timestamp("2026-11-30T22:30:00")
    exit = timestamp("2026-12-01T01:15:00")
    nov_start = timestamp("2026-11-01T00:00:00")
    dec_start = timestamp("2026-12-01T00:00:00")
    jan_start = timestamp("2027-01-01T00:00:00")
    november = time_in_range(entry, exit, nov_start, dec_start)
    december = time_in_range(entry, exit, dec_start, jan_start)
    print("November:", november)
    print("December:", december)
    print("Total:   ", november + december)
