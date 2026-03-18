with open("api.py", "r", encoding="utf-8") as f:
    lines = f.readlines()

# Fix init_database: lines 178-264 (0-indexed) need 4 more spaces (they have 4, need 8)
# except blocks at 265-276 need to stay at 4 spaces (align with try)
for i in range(178, 265):
    if i < len(lines) and lines[i].strip() and not lines[i].strip().startswith("except"):
        if lines[i].startswith("    ") and not lines[i].startswith("        "):
            lines[i] = "    " + lines[i]

# Fix except DatabaseError and except PyMongoError - they should be at 4 spaces
for i in range(265, 280):
    if i < len(lines) and "except" in lines[i] and not lines[i].startswith("    except"):
        if lines[i].strip().startswith("except"):
            lines[i] = "    " + lines[i].lstrip()

with open("api.py", "w", encoding="utf-8") as f:
    f.writelines(lines)
print("Done")
