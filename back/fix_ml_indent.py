"""
Fix indentation in ml_module.py: Lines at column 0 that should be inside
functions/classes get indented with the expected block indent.
"""
import re


def count_indent(line: str) -> int:
    """Return number of leading spaces."""
    stripped = line.lstrip()
    return len(line) - len(stripped)


def is_block_starter(stripped: str) -> bool:
    """True if line starts a new block (ends with :)."""
    if not stripped.endswith(":"):
        return False
    return (
        stripped.startswith("def ") or stripped.startswith("class ") or
        stripped.startswith("if ") or stripped.startswith("elif ") or
        stripped.startswith("else") or stripped.startswith("for ") or
        stripped.startswith("while ") or stripped.startswith("with ") or
        stripped.startswith("try") or stripped.startswith("except ") or
        stripped.startswith("finally") or
        stripped.startswith(")")  # ) -> Type: closes multiline def
    )


def should_skip_indent(line: str, stripped: str) -> bool:
    """Lines we should NOT add indent to (def/class handled separately)."""
    if not stripped:
        return True
    if stripped.strip() == ")":
        return True
    if stripped.strip() in ('"""', "'''") or re.match(r'^\s*"""', line) or re.match(r"^\s*'''", line):
        return True
    return False


def fix_indentation(filepath: str) -> None:
    with open(filepath, "r", encoding="utf-8") as f:
        lines = f.readlines()

    result = []
    indent_stack = [0]

    for i, line in enumerate(lines):
        stripped = line.lstrip()
        current_indent = count_indent(line)

        if not stripped:
            result.append(line)
            continue

        # We're inside a block and this line wrongly has 0 indent - fix it first (don't pop)
        if current_indent == 0 and len(indent_stack) > 1:
            if should_skip_indent(line, stripped):
                result.append(line)
                continue
            if stripped.startswith("def ") or stripped.startswith("class "):
                # New top-level def/class - previous block ended
                indent_stack = [0]
                result.append(line)
                indent_stack.append(4)
                continue
            # Fix: add expected indent
            base = indent_stack[-1]
            fixed = " " * base + stripped + ("\n" if line.endswith("\n") else "")
            result.append(fixed)
            if is_block_starter(stripped):
                indent_stack.append(base + 4)
            continue

        # Pop indent stack when we dedent (line has less indent than expected)
        while len(indent_stack) > 1 and current_indent < indent_stack[-1]:
            indent_stack.pop()

        result.append(line)

        # Push new block level when we see a block starter
        if is_block_starter(stripped):
            indent_stack.append(current_indent + 4)

    with open(filepath, "w", encoding="utf-8") as f:
        f.writelines(result)


if __name__ == "__main__":
    fix_indentation("ml_module.py")
    print("Fixed ml_module.py")
