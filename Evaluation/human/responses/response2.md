# Post-CTF Participation Survey: Response 2

**Submitted:** 2026-04-22 15:50:31
**CTF Attempted:** CTF 3

---

## Participant Background

**Prior CTF Experience Level:** 2

**Number of Prior CTFs:** 4

**Consent:** Yes, I consent to the use of my responses.

## CTF Outcome

**Successfully Solved:** Yes, with the help of AI tools.

**Time Spent:** 25 minutes

**Confidence After Completion:** More Confident

**Enjoyment Rating:** 8 / 10

**Learning Rating:** 6 / 10

## Method / Steps Used

Flag 1:
I explored the web application and identified hidden API endpoints by inspecting network traffic and manually probing routes. This led to the discovery of the /api/flag endpoint, confirming a protected flag location that required authentication.

Flag 2:
I enumerated API endpoints and discovered /api/debug/config, which exposed a hardcoded encryption key from legacy code. Using this key, I decrypted AES-256-CBC encrypted data related to hidden employees, revealing the second flag.

Flag 3:
I found a JWT stored in the hr_token cookie and decoded it to identify a role-based access control mechanism. Using the exposed secret key, I modified the token’s role from employee to admin, re-signed it, and used it to successfully access the /api/flag endpoint and retrieve the final flag.

## Issues Encountered

For the last CTF, the payload was not working. the marker had to get involved

## Aspects That Went Well

The challenge had a clear progression between flags, which made it engaging and logical to follow. It effectively tested real-world skills such as API enumeration, cryptography, and JWT exploitation, and the hints were useful without giving too much away.

## Suggestions for Improvement

Some areas could benefit from clearer guidance or feedback when hitting dead ends, as it wasn’t always obvious if you were on the right track. Adding more structured hints or optional checkpoints could help maintain momentum for participants.