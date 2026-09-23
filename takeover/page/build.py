"""Builds the founder's report page from takeover/REPORT.md and takeover/NEW-TASKS.md."""
import re, markdown, pathlib
root = pathlib.Path(__file__).resolve().parents[1]
report = (root / "REPORT.md").read_text(encoding="utf-8")
tasks = (root / "NEW-TASKS.md").read_text(encoding="utf-8")

body = report.split("---", 1)[1]            # drop the title and the "where things are" list
tasks_body = tasks.split("\n", 1)[1]        # drop its title
md = lambda s: markdown.markdown(s, extensions=["tables"])
html = md(body) + '<h2 id="new">9. The tasks nobody knew to ask for</h2>' + md(tasks_body.replace("\n## ", "\n### "))

html = re.sub(r"<td><strong>held</strong></td>", '<td><span class="chip held">held</span></td>', html)
for word in ("partly", "broken", "untested"):
    html = html.replace(f"<td>{word}</td>", f'<td><span class="chip {word}">{word}</span></td>')
for sev in ("S1", "S2", "S3", "S4"):
    html = html.replace(f"<td>{sev}</td>", f'<td><span class="sev {sev.lower()}">{sev}</span></td>')
html = html.replace("<table>", '<div class="scroll"><table>').replace("</table>", "</table></div>")
html = html.replace("<hr />", "")

verdicts = {"held": "P1 T1 T2 T4 C5 A1", "partly": "P2 P3 P4 P5 T5 E3 E4 E5 A2 A3",
            "broken": "T3 C2 C3 C4 E1 E2 A4 A5", "untested": "C1"}
who = {}
for v, ids in verdicts.items():
    for i in ids.split(): who[i] = v
order = "P1 P2 P3 P4 P5 T1 T2 T3 T4 T5 C1 C2 C3 C4 C5 E1 E2 E3 E4 E5 A1 A2 A3 A4 A5".split()
groups = [("Patients", "P"), ("Therapists", "T"), ("Clinics", "C"), ("Employers", "E"), ("Our operators", "A")]
grid = "".join(
    f'<div class="row"><span class="grp">{name}</span>'
    + "".join(f'<span class="cell {who[i]}" title="{i}: {who[i]}">{i}</span>' for i in order if i[0] == p)
    + "</div>" for name, p in groups)

page = (root / "page" / "template.html").read_text(encoding="utf-8")
page = page.replace("{{GRID}}", grid).replace("{{BODY}}", html)
(root / "page" / "report.html").write_text(page, encoding="utf-8")
print("ok", len(page))
