"""
Restore spaces in Python files corrupted by a script that removed whitespace.
Run: python fix_spaces.py <file_or_dir>

Usage:
  python fix_spaces.py vitalio/back/api.py
  python fix_spaces.py vitalio/back   # Fix all .py in back/
"""

import re
import sys
import os

# Python keywords that must be followed by space when next char starts identifier
KEYWORDS = [
    "and", "as", "assert", "async", "await", "break", "class", "continue",
    "def", "del", "elif", "else", "except", "finally", "for", "from", "global",
    "if", "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass",
    "raise", "return", "try", "while", "with", "yield",
]

# Built-in names that often follow keywords
BUILTINS = ["None", "True", "False", "Exception", "Dict", "List", "Optional", "Any", "str"]


def restore_spaces(content: str) -> str:
    """Restore spaces in corrupted Python source."""
    result = content

    # 1. import X -> import X
    result = re.sub(r'\bimport([a-zA-Z_][a-zA-Z0-9_.]*)', r'import \1', result)

    # 2. from X import Y -> from X import Y (also fix ,X -> , X in import list)
    def fix_import_list(m):
        rest = m.group(2)
        rest = re.sub(r',([a-zA-Z_])', r', \1', rest)
        return f'from {m.group(1)} import {rest}'
    result = re.sub(r'\bfrom([a-zA-Z_][a-zA-Z0-9_.]*)import([a-zA-Z_][a-zA-Z0-9_.\[\],\s]*)', fix_import_list, result)
    result = re.sub(r'\bfrom([a-zA-Z_][a-zA-Z0-9_.]*)', r'from \1', result)

    # 3. def name( -> def name(
    result = re.sub(r'\bdef([a-zA-Z_][a-zA-Z0-9_]*)', r'def \1', result)

    # 4. class Name( -> class Name(
    result = re.sub(r'\bclass([a-zA-Z_][a-zA-Z0-9_]*)', r'class \1', result)

    # 5. return X -> return X
    result = re.sub(r'\breturn([a-zA-Z_][a-zA-Z0-9_.\[\]\(\)\'\",\s\{\}\-]*)', r'return \1', result)

    # 6. raise X -> raise X
    result = re.sub(r'\braise([a-zA-Z_][a-zA-Z0-9_.\[\]\(\)]*)', r'raise \1', result)

    # 7. global X -> global X
    result = re.sub(r'\bglobal([a-zA-Z_][a-zA-Z0-9_]*)', r'global \1', result)

    # 8. except X as e -> except X as e
    result = re.sub(r'\bexcept([a-zA-Z_][a-zA-Z0-9_.\[\]\(\)]*)as([a-zA-Z_][a-zA-Z0-9_]*)', r'except \1 as \2', result)
    result = re.sub(r'\bexcept([a-zA-Z_][a-zA-Z0-9_.\[\]\(\)]*)', r'except \1', result)

    # 9. is None, is True, is False
    result = re.sub(r'\bis(None|True|False)\b', r'is \1', result)
    result = re.sub(r'\bnot([a-zA-Z_][a-zA-Z0-9_]*)', r'not \1', result)

    # 10. Comma in type hints: ,X -> , X
    result = re.sub(r',([a-zA-Z_\[\]\"\'])', r', \1', result)

    return result


def restore_spaces_v2(content: str) -> str:
    """Second pass: if/elif/for/while/with/lambda, etc. Avoid breaking 'format'."""
    result = content
    # if, elif, while, with, lambda - but NOT 'for' (breaks 'format')
    for kw in ["if", "elif", "while", "with", "lambda"]:
        pat = r"\b(%s)([a-zA-Z_\[\]()0-9,\'\".\s{}\-:])" % re.escape(kw)
        result = re.sub(pat, r'\1 \2', result)
    # for x in y - only when followed by "in"
    result = re.sub(r'\bfor([a-zA-Z_][a-zA-Z0-9_]*)\bin\b', r'for \1 in ', result)
    return result


def restore_spaces_v3(content: str) -> str:
    """Third pass: is not None, return False, multipart import, format."""
    result = content
    # is not None, is not True, is not False
    result = re.sub(r'\bisnot(None|True|False)\b', r'is not \1', result)
    # returnFalse, returnTrue
    result = re.sub(r'\breturn(False|True|None)\b', r'return \1', result)
    # word import Word (from x.y import Z - fix multipartimportMIME)
    result = re.sub(r'([a-z_]+)import([A-Za-z_][a-zA-Z0-9_]*)', r'\1 import \2', result)
    # Fix "for mat" -> "format" (undo over-correction)
    result = re.sub(r'\bfor mat\b', 'format', result)
    # and/or - only when clearly keyword (not inside import, CORS, etc)
    result = re.sub(r'(None|True|False)(and)([a-zA-Z_\(\[0-9])', r'\1 \2 \3', result)
    result = re.sub(r'\)(and|or)\(', r') \1 (', result)
    result = re.sub(r'([0-9])(or)([a-zA-Z_\(\[])', r'\1 \2 \3', result)
    result = re.sub(r'([0-9])(and)([a-zA-Z_\(\[])', r'\1 \2 \3', result)
    # val if cond else val
    result = re.sub(r'([0-9])(else)(None|[\'\"])', r'\1 \2 \3', result)
    return result


def fix_file(path: str, backup: bool = True) -> bool:
    """Fix a single file. Returns True if changes were made."""
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()
    fixed = restore_spaces(content)
    fixed = restore_spaces_v2(fixed)
    fixed = restore_spaces_v3(fixed)
    if fixed != content:
        if backup:
            backup_path = path + '.corrupted_backup'
            with open(backup_path, 'w', encoding='utf-8', newline='\n') as f:
                f.write(content)
            print(f"  Backup: {backup_path}")
        with open(path, 'w', encoding='utf-8', newline='\n') as f:
            f.write(fixed)
        return True
    return False


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('-')]
    backup = '--no-backup' not in sys.argv
    if not args:
        print("Usage: python fix_spaces.py [--no-backup] <file.py> | <directory>")
        sys.exit(1)
    target = args[0]
    if not os.path.exists(target):
        print(f"Path not found: {target}")
        sys.exit(1)
    if os.path.isfile(target):
        if target.endswith('.py'):
            if fix_file(target, backup=backup):
                print(f"Fixed: {target}")
            else:
                print(f"No changes: {target}")
        else:
            print("Only .py files supported")
    else:
        count = 0
        for root, _dirs, files in os.walk(target):
            for f in files:
                if f.endswith('.py') and '.venv' not in root and 'node_modules' not in root:
                    p = os.path.join(root, f)
                    if fix_file(p, backup=backup):
                        print(f"Fixed: {p}")
                        count += 1
        print(f"Done. Fixed {count} file(s).")


if __name__ == "__main__":
    main()
