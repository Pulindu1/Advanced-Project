import hashlib, base64, re, pathlib
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

part1 = "dr-part1-3d7fa8c2b6e04915"
part2 = "dr-part2-7f1a9c5e3b8d4a6f"
key = hashlib.sha256((part1 + part2).encode()).digest()

blob = (pathlib.Path(__file__).parent / 'vault.enc').read_text()
iv = base64.b64decode(re.search(r'\[IV_B64\]\s+(\S+)', blob).group(1))
ct = base64.b64decode(re.search(r'\[CIPHERTEXT_B64\]\s+(\S+)', blob).group(1))

print(AESGCM(key).decrypt(iv, ct, None).decode())