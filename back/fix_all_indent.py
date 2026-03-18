#!/usr/bin/env python3
"""Fix indentation using indent stack."""
with open("api.py", "r", encoding="utf-8") as f:
    lines = f.readlines()

stack = [0]
BLOCK_CLOSERS = ("except", "else", "elif", "finally")

for i in range(len(lines)):
    line = lines[i]
    stripped = line.strip()
    if not stripped:
        continue

    indent = len(line) - len(line.lstrip())
    first_word = stripped.split()[0] if stripped.split() else ""

    if first_word in BLOCK_CLOSERS:
        if len(stack) > 1:
            stack.pop()
        target = stack[-1]
        if indent != target:
            lines[i] = " " * target + stripped + "\n"
        stack.append(target + 4)
    elif stripped.startswith("def ") or stripped.startswith("class "):
        if indent == 0:
            while len(stack) > 1:
                stack.pop()
        target = stack[-1]
        if indent < target:
            lines[i] = " " * target + stripped + "\n"
        stack.append(target + 4)
    elif stripped.startswith("@"):
        target = stack[-1] if stack else 0
        if indent < target:
            lines[i] = " " * target + stripped + "\n"
    elif stripped.rstrip().endswith(":") and "http" not in stripped and "//" not in stripped:
        target = stack[-1]
        if indent < target:
            lines[i] = " " * target + stripped + "\n"
        stack.append(target + 4)
    else:
        target = stack[-1]
        if indent < target:
            lines[i] = " " * target + stripped + "\n"

with open("api.py", "w", encoding="utf-8") as f:
    f.writelines(lines)
print("Done.")
