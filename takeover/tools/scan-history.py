"""Scan git history for credential-shaped strings, never printing a value.

Usage: python3 takeover/tools/scan-history.py origin/main   (or --all)
Needs a FULL clone: a shallow one hides older commits (git fetch --unshallow origin).
The control below must detect a planted fake before any "0 findings" means anything.
"""
import subprocess,re,collections,sys
pats={
 "postgres URL with password": re.compile(r'postgres(?:ql)?://[^:\s/@"\'`]+:([^@\s"\'`]{6,})@([A-Za-z0-9.-]+)'),
 "OpenAI key": re.compile(r'sk-(?:proj-)?[A-Za-z0-9_-]{20,}'),
 "Stripe secret": re.compile(r'sk_(?:live|test)_[A-Za-z0-9]{20,}'),
 "Stripe webhook": re.compile(r'whsec_[A-Za-z0-9]{16,}'),
 "Resend key": re.compile(r'\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{8,}'),
 "Vercel blob token": re.compile(r'vercel_blob_rw_[A-Za-z0-9_]{16,}'),
 "Neon API key": re.compile(r'napi_[A-Za-z0-9]{20,}'),
 "GitHub token": re.compile(r'gh[pous]_[A-Za-z0-9]{30,}'),
}
placeholder=re.compile(r'^(password|pass|pw|secret|xxx+|\*+|<[^>]*>|\$\{[^}]*\}|postgres|changeme|example)$',re.I)
def scan(text):
    found=collections.defaultdict(set); commit=None; fname=None
    for line in text.splitlines():
        if line.startswith('COMMIT '): commit=line[7:]; continue
        if line.startswith('+++ b/'): fname=line[6:]; continue
        if not line.startswith(('+','-')) or line.startswith(('+++','---')): continue
        for kind,p in pats.items():
            for m in p.finditer(line):
                if kind.startswith("postgres"):
                    if placeholder.match(m.group(1)) or m.group(2) in ("localhost","127.0.0.1","host","HOST"): continue
                    ident=m.group(2)
                else: ident=m.group(0)[:6]+"…"
                found[(kind,fname)].add((commit,ident))
    return found
# control
ctl=scan("COMMIT test\n+++ b/x\n+DATABASE_URL=postgresql://neondb_owner:npg_AbC123xyz@ep-fake-host-12345.us-east-2.aws.neon.tech/neondb\n")
assert ctl, "CONTROL FAILED: the scanner cannot see a connection string"
print("control: detected a planted connection string")
ref=sys.argv[1]
text=subprocess.run(['git','log','-p',*ref.split(),'--format=COMMIT %h','--no-color'],capture_output=True,text=True,errors='ignore').stdout
found=scan(text)
for (kind,f),hits in sorted(found.items()):
    commits=sorted({c for c,_ in hits}); ids=sorted({v for _,v in hits})
    print(f"{kind:26} {f:50} {len(commits)} commits {commits[:5]} {ids[:3]}")
print(ref,"findings:",len(found))
