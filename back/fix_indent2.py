#!/usr/bin/env python3
"""Fix over-indentation: module-level code should be at column 0."""

with open("api.py", "r", encoding="utf-8") as f:
    content = f.read()

# Fix the corrupted if block - only env_path and load_dotenv should be inside
old_if = """env_path = '.env'
if not os.path.exists(env_path ) :

    env_path = '../.env'
    load_dotenv(env_path )


    logging.basicConfig"""

new_if = """env_path = '.env'
if not os.path.exists(env_path):
    env_path = '../.env'
load_dotenv(env_path)

logging.basicConfig"""

content = content.replace(old_if, new_if)

# Remove erroneous 4-space indent from module-level assignments (AUTH0_DOMAIN, etc.)
# These appear as "    NAME = " and should be "NAME = "
import re
# Only remove indent from lines that are clearly module-level: all-caps identifiers
def demote_module_level(match):
    return match.group(1) + "\n"
content = re.sub(r'\n    ([A-Z_][A-Z0-9_]* = )', r'\n\1', content)

# Also fix app, logger, CORS 
content = re.sub(r'\n    (app\.)', r'\n\1', content)
content = re.sub(r'\n    (logger\.)', r'\n\1', content)
content = re.sub(r'\n    (CORS\()', r'\n\1', content)

with open("api.py", "w", encoding="utf-8") as f:
    f.write(content)
print("Done.")
