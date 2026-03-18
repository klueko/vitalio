#!/usr/bin/env python3
"""Fix indentation in api.py - adds proper indent to lines that lost it."""

with open("api.py", "r", encoding="utf-8") as f:
    lines = f.readlines()

result = []
indent_stack = [0]

BLOCK_STARTERS = ("if ", "elif ", "else:", "for ", "while ", "try:", "except ", "except:", "finally:", "with ")
TOP_LEVEL = ("def ", "class ", "@")

def get_indent(s):
    return len(s) - len(s.lstrip())

def get_first_token(s):
    s = s.strip()
    if not s:
        return ""
    for sep in " ():\n":
        if sep in s:
            idx = s.find(sep)
            if idx > 0:
                return s[:idx].strip()
    return s.split()[0] if s.split() else ""

for i, line in enumerate(lines):
    stripped = line.lstrip()
    raw_indent = get_indent(line)

    if not stripped:
        result.append(line)
        continue

    first = get_first_token(stripped)
    ends_colon = stripped.rstrip().endswith(":")

    if stripped.startswith("@") or (stripped.startswith("def ") and "(" in stripped) or (stripped.startswith("class ") and "(" in stripped):
        while len(indent_stack) > 1:
            indent_stack.pop()
        target = 0
        indent_stack.append(4)
        result.append(" " * target + stripped + "\n")

    elif any(stripped.startswith(b) for b in BLOCK_STARTERS):
        if first in ("else", "elif", "except", "finally"):
            while len(indent_stack) > 1:
                indent_stack.pop()
        target = indent_stack[-1]
        indent_stack.append(target + 4)
        result.append(" " * target + stripped + "\n")

    else:
        target = indent_stack[-1]
        if raw_indent == 0 and len(indent_stack) > 1:
            result.append(" " * target + stripped + "\n")
        elif raw_indent >= target:
            result.append(line)
        else:
            result.append(" " * target + stripped + "\n")

    if not ends_colon and first not in ("else", "elif", "except", "finally"):
        pass
    elif ends_colon and first in ("if", "elif", "for", "while", "try", "with") or "except" in first or first == "else" or first == "finally":
        pass
    elif not ends_colon:
        while len(indent_stack) > 1:
            indent_stack.pop()

with open("api.py", "w", encoding="utf-8") as f:
    f.writelines(result)
print("Done.")
