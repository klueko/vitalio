with open("api.py", "r", encoding="utf-8") as f:
    lines = f.readlines()

# Find the range: from "    app" or "    logging" to before "def get_mongo_client"
start, end = None, None
for i, line in enumerate(lines):
    s = line.strip()
    if s.startswith("app = ") or s.startswith("logging.basicConfig") and line.startswith("    "):
        if start is None:
            start = i
    if start is not None and s.startswith("def get_mongo_client"):
        end = i
        break
if start is None:
    start = 34
if end is None:
    end = 136

result = []
for i, line in enumerate(lines):
    if start <= i < end and line.startswith("    "):
        result.append(line[4:])
    else:
        result.append(line)

with open("api.py", "w", encoding="utf-8") as f:
    f.writelines(result)
print("Done")
