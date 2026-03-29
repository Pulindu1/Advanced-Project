from Crypto.Cipher import AES
import hashlib, base64

encrypted = '2Mc2NehcojWoJDxQfeZmAQ==:n9huRl/J+s87oF1G8uJD5emX7W5XH0O7Jh+vL1Eq9v3xtB/FMjflNbU2gm8nk819'
key_passphrase = 'CTF_2026_SECRET_KEY_XJ9K2L'

iv_b64, ciphertext = encrypted.split(':')
key = hashlib.sha256(key_passphrase.encode()).digest()
iv = base64.b64decode(iv_b64)
cipher = AES.new(key, AES.MODE_CBC, iv)
decrypted = cipher.decrypt(base64.b64decode(ciphertext))
print(decrypted.decode('utf-8').rstrip('\x00'))