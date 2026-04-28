import hashlib
import json
import sys

def solve_pow(nonce, difficulty):
    prefix = '0' * difficulty
    counter = 0
    while True:
        solution = str(counter)
        hash_input = nonce + solution
        hash_val = hashlib.sha256(hash_input.encode()).hexdigest()
        if hash_val.startswith(prefix):
            return solution, hash_val
        counter += 1

nonce = sys.argv[1]
difficulty = int(sys.argv[2])
solution, hash_val = solve_pow(nonce, difficulty)
print(f"Solution: {solution}")
print(f"Hash: {hash_val}")
