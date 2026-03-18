#!/usr/bin/env python3
"""Fix common token-merge typos from comment removal."""
import re

with open("api.py", "r", encoding="utf-8") as f:
    content = f.read()

fixes = [
    (r"\bor\b", " or "),
    (r"\band\b", " and "),
    (r"\bnot\b", " not "),
    (r"\bin\b", " in "),
    (r"\bis\b", " in "),  # careful - "is" not "in"
]
# Simpler: fix known bad patterns
patterns = [
    (r"(\w)or(\w)", lambda m: m.group(1) + " or " + m.group(2) if m.group(0) not in ("for", "order", "normal", "doctor", "major", "minor", "prior", "cursor", "auth", "error", "monitor", "motor", "floor", "color", "doctor", "author", "horror", "visitor", "director", "doctor") else m.group(0)),
]
# Safer: only fix known broken patterns
replacements = [
    ("isnotNone", "is not None"),
    ("is notNone", "is not None"),
    ("tzinfoisnotNone", "tzinfo is not None"),
    ("not fnameandnotlname", "not fname and not lname"),
    ("patient_emailandpatient_user_id_auth", "patient_email and patient_user_id_auth"),
    ("send_emailandpatient_email", "send_email and patient_email"),
    ("email_rawornotisinstance", "email_raw or not isinstance"),
    ('if"@"in sand"."in sandlen', 'if "@" in s and "." in s and len'),
    ("utf -8", "utf-8"),
    ("http://localhost :", "http://localhost:"),
    ("http://127.0.0.1 :", "http://127.0.0.1:"),
    ("for mat", "format"),
    ("in valid", "invalid"),
    ("in vitation", "invitation"),
    ("in vite", "invite"),
    ("in jected", "injected"),
    ("in formation", "information"),
    ("in fo", "info"),
    ("in ternal", "internal"),
    ("in ternet", "internet"),
    ("in serts", "inserts"),
    ("in serted", "inserted"),
    ("in serting", "inserting"),
    ("as signed", "assigned"),
    ("for bidden", "forbidden"),
    ("in itialize", "initialize"),
    ("return s", "returns"),
    ("is suer", "issuer"),
]

for old, new in replacements:
    content = content.replace(old, new)

with open("api.py", "w", encoding="utf-8") as f:
    f.write(content)
print("Token fixes applied.")
