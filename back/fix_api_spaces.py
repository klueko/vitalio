#!/usr/bin/env python3
"""Restore spaces in minified/corrupted api.py"""

import re

with open("api.py", "r", encoding="utf-8") as f:
    content = f.read()

id_start = r"[a-zA-Z_]"
id_cont = r"[a-zA-Z0-9_.]"
follow = r"[a-zA-Z_(\"'\[{]"

patterns = [
    (r"\bimport" + id_start + id_cont + "*", lambda m: "import " + m.group(0)[6:]),
    (r"\bfrom" + id_start + id_cont + "*", lambda m: "from " + m.group(0)[4:]),
    (r"\bas" + id_start + id_cont + "*", lambda m: "as " + m.group(0)[2:]),
    (r"\bif" + id_start + id_cont + "*", lambda m: "if " + m.group(0)[2:]),
    (r"\belif" + id_start + id_cont + "*", lambda m: "elif " + m.group(0)[4:]),
    (r"\bfor" + id_start + id_cont + "*", lambda m: "for " + m.group(0)[3:]),
    (r"\bwhile" + id_start + id_cont + "*", lambda m: "while " + m.group(0)[5:]),
    (r"\bdef" + id_start + id_cont + "*", lambda m: "def " + m.group(0)[3:]),
    (r"\bclass" + id_start + id_cont + "*", lambda m: "class " + m.group(0)[5:]),
    (r"\breturn" + follow, lambda m: "return " + m.group(0)[6:]),
    (r"\band" + follow, lambda m: "and " + m.group(0)[3:]),
    (r"\bor" + follow, lambda m: "or " + m.group(0)[2:]),
    (r"\bnot" + follow, lambda m: "not " + m.group(0)[3:]),
    (r"\bisnot", lambda m: "is not"),
    (r"\bis" + id_start + id_cont + "*", lambda m: "is " + m.group(0)[2:]),
    (r"\bin" + follow, lambda m: "in " + m.group(0)[2:]),
    (r"\bexcept" + id_start + id_cont + "*", lambda m: "except " + m.group(0)[6:]),
    (r"\bwith" + id_start + id_cont + "*", lambda m: "with " + m.group(0)[4:]),
    (r"\braise" + follow, lambda m: "raise " + m.group(0)[5:]),
    (r"\bglobal" + id_start + id_cont + "*", lambda m: "global " + m.group(0)[6:]),
    (r"\byield" + follow, lambda m: "yield " + m.group(0)[5:]),
    (r"\blambda" + id_start + id_cont + "*", lambda m: "lambda " + m.group(0)[6:]),
]

for pat, repl in patterns:
    content = re.sub(pat, repl, content)

content = re.sub(r"Noneand", "None and", content)
content = re.sub(r"Trueand", "True and", content)
content = re.sub(r"Falseand", "False and", content)
content = re.sub(r"Noneor", "None or", content)
content = re.sub(r"Trueor", "True or", content)
content = re.sub(r"Falseor", "False or", content)

trail = r"[a-zA-Z0-9_)\]\}]"
content = re.sub(r"(" + trail + r")=", r"\1 =", content)
content = re.sub(r"=(" + id_start + r"|\d|\[|\{|\"|\'|\-)", r"= \1", content)
content = re.sub(r"(" + trail + r")\+", r"\1 +", content)
content = re.sub(r"(" + trail + r")\-", r"\1 -", content)
content = re.sub(r"(" + trail + r")\*", r"\1 *", content)
content = re.sub(r"(" + trail + r")\/", r"\1 /", content)
content = re.sub(r"(" + trail + r")\%", r"\1 %", content)
content = re.sub(r"(" + trail + r")\,", r"\1 ,", content)
content = re.sub(r"(" + trail + r")\:", r"\1 :", content)
content = re.sub(r"(" + trail + r")\{", r"\1 {", content)
content = re.sub(r"(" + trail + r")\}", r"\1 }", content)
content = re.sub(r"(" + trail + r")\)", r"\1 )", content)
content = re.sub(r"(" + trail + r")\[", r"\1 [", content)
content = re.sub(r"(" + trail + r")\<", r"\1 <", content)
content = re.sub(r"(" + trail + r")\>", r"\1 >", content)
content = re.sub(r"(" + trail + r")\!", r"\1 !", content)

with open("api.py", "w", encoding="utf-8") as f:
    f.write(content)
print("Done.")
