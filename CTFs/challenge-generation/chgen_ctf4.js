/**
 * Challenge Generation Script for CTF_4 (IntraDesk KB)
 * 
 * Integrates with the challenge-generation system to deploy
 * unique instances for each participant.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Generate unique credentials and flags for a user
 */
function generateUserCredentials(username, email) {
  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(4).toString('hex');
  
  return {
    username,
    email,
    password: `ctf_${randomSuffix}`,
    flag: `CTF{dom_xss_${username}_${timestamp}}`,
    adminFlag: `CTF{admin_intradesk_${randomSuffix}}`,
  };
}

/**
 * Generate environment file for a specific user instance
 */
function generateEnvFile(credentials, instancePort) {
  const apiPort = instancePort;
  const webPort = instancePort + 1;
  const dbPort = instancePort + 2;
  const redisPort = instancePort + 3;
  
  return `# Instance for ${credentials.username}
DATABASE_URL=postgresql://intradesk_${credentials.username}:${credentials.password}@db:${dbPort}/intradesk_kb_${credentials.username}
POSTGRES_USER=intradesk_${credentials.username}
POSTGRES_PASSWORD=${credentials.password}
POSTGRES_DB=intradesk_kb_${credentials.username}
REDIS_URL=redis://redis:${redisPort}
API_PORT=${apiPort}
NODE_ENV=production
JWT_SECRET=${crypto.randomBytes(32).toString('hex')}
SESSION_SECRET=${crypto.randomBytes(32).toString('hex')}
VITE_API_URL=http://localhost:${apiPort}
BOT_BASE_URL=http://web:${webPort}
BOT_API_URL=http://api:${apiPort}
ADMIN_EMAIL=admin@intradesk.local
ADMIN_PASSWORD=${credentials.password}
CTF_FLAG_PREFIX=CTF{
CTF_FLAG_SUFFIX=}
USER_FLAG=${credentials.flag}
ADMIN_FLAG=${credentials.adminFlag}
`;
}

/**
 * Generate docker-compose override for an instance
 */
function generateDockerComposeOverride(credentials, instancePort) {
  const apiPort = instancePort;
  const webPort = instancePort + 1;
  
  return `version: '3.8'

services:
  api:
    container_name: intradesk-api-${credentials.username}
    ports:
      - "${apiPort}:3000"
    environment:
      - ADMIN_FLAG=${credentials.adminFlag}

  web:
    container_name: intradesk-web-${credentials.username}
    ports:
      - "${webPort}:5173"

  db:
    container_name: intradesk-db-${credentials.username}

  redis:
    container_name: intradesk-redis-${credentials.username}

  bot:
    container_name: intradesk-bot-${credentials.username}
`;
}

/**
 * Generate credentials file for distribution to user
 */
function generateCredentialsFile(credentials, apiPort, webPort) {
  return {
    challenge: "IntraDesk Knowledge Base - DOM XSS",
    username: credentials.username,
    email: credentials.email,
    password: credentials.password,
    urls: {
      frontend: `http://ctf-server:${webPort}`,
      api: `http://ctf-server:${apiPort}`,
    },
    admin: {
      email: "admin@intradesk.local",
      password: credentials.password,
      note: "Do NOT use these credentials. The admin account is for the bot only."
    },
    objective: "Exploit the DOM XSS vulnerability to steal the admin's flag",
    flag_format: "CTF{...}",
    hints: [
      "Search functionality reflects user input",
      "Check how the search term is displayed in the DOM",
      "The admin bot will visit any KB URL you report",
      "Look for non-HttpOnly cookies",
    ]
  };
}

/**
 * Main generation function
 */
async function generateChallenge(config) {
  const { username, email, outputDir, startPort = 10000 } = config;
  
  console.log(`\n🏗️  Generating challenge instance for ${username}...`);
  
  // Generate credentials
  const credentials = generateUserCredentials(username, email);
  console.log(`✅ Generated credentials`);
  
  // Create output directory
  const instanceDir = path.join(outputDir, `ctf4_${username}`);
  if (!fs.existsSync(instanceDir)) {
    fs.mkdirSync(instanceDir, { recursive: true });
  }
  
  // Generate files
  const envContent = generateEnvFile(credentials, startPort);
  fs.writeFileSync(path.join(instanceDir, '.env'), envContent);
  console.log(`✅ Generated .env file`);
  
  const overrideContent = generateDockerComposeOverride(credentials, startPort);
  fs.writeFileSync(path.join(instanceDir, 'docker-compose.override.yml'), overrideContent);
  console.log(`✅ Generated docker-compose override`);
  
  const credsFile = generateCredentialsFile(credentials, startPort, startPort + 1);
  fs.writeFileSync(
    path.join(instanceDir, 'credentials.json'),
    JSON.stringify(credsFile, null, 2)
  );
  console.log(`✅ Generated credentials.json`);
  
  // Generate README for the instance
  const readmeContent = `# IntraDesk KB Challenge - ${username}

Your unique instance has been deployed!

## Access Information

- **Frontend**: http://ctf-server:${startPort + 1}
- **API**: http://ctf-server:${startPort}

## Your Credentials

- **Email**: ${credentials.email}
- **Password**: ${credentials.password}

## Getting Started

1. Navigate to the frontend URL
2. Create an account or login with your credentials
3. Explore the Knowledge Base
4. Find and exploit the DOM XSS vulnerability
5. Steal the admin's flag!

## Objective

Get the admin bot to execute JavaScript in their session and exfiltrate their flag.

## Hints

- Search functionality reflects user input
- Check the browser DevTools to see how the page is constructed
- The admin will visit any KB URL you report
- Look for cookies that JavaScript can access

## Flag Format

Your flag will look like: \`CTF{...}\`

## Need Help?

Check the hints in your credentials.json file or ask for support.

Good luck! 🎯
`;
  
  fs.writeFileSync(path.join(instanceDir, 'README.md'), readmeContent);
  console.log(`✅ Generated README.md`);
  
  console.log(`\n✨ Challenge instance created successfully!`);
  console.log(`📁 Location: ${instanceDir}`);
  console.log(`🔗 Frontend: http://ctf-server:${startPort + 1}`);
  console.log(`🔗 API: http://ctf-server:${startPort}`);
  console.log(`🏴 Flag: ${credentials.flag}\n`);
  
  return {
    username,
    credentials,
    ports: {
      api: startPort,
      web: startPort + 1,
      db: startPort + 2,
      redis: startPort + 3,
    },
    instanceDir,
  };
}

/**
 * Generate multiple instances
 */
async function generateBatch(users, outputDir, startPort = 10000) {
  const instances = [];
  let currentPort = startPort;
  
  for (const user of users) {
    const instance = await generateChallenge({
      username: user.username,
      email: user.email,
      outputDir,
      startPort: currentPort,
    });
    
    instances.push(instance);
    currentPort += 10; // Reserve 10 ports per instance
  }
  
  // Generate master credentials file
  const masterCreds = instances.map(inst => ({
    username: inst.username,
    email: inst.credentials.email,
    password: inst.credentials.password,
    flag: inst.credentials.flag,
    frontend: `http://ctf-server:${inst.ports.web}`,
    api: `http://ctf-server:${inst.ports.api}`,
  }));
  
  fs.writeFileSync(
    path.join(outputDir, 'all_credentials.json'),
    JSON.stringify(masterCreds, null, 2)
  );
  
  console.log(`\n🎉 Generated ${instances.length} challenge instances!`);
  console.log(`📄 Master credentials: ${path.join(outputDir, 'all_credentials.json')}\n`);
  
  return instances;
}

// Example usage
if (require.main === module) {
  const users = [
    { username: 'alice', email: 'alice@ctf.local' },
    { username: 'bob', email: 'bob@ctf.local' },
    { username: 'charlie', email: 'charlie@ctf.local' },
  ];
  
  const outputDir = path.join(__dirname, 'generated-instances');
  
  generateBatch(users, outputDir, 10000)
    .then(() => console.log('✅ All instances generated'))
    .catch(err => console.error('❌ Error:', err));
}

module.exports = {
  generateChallenge,
  generateBatch,
  generateUserCredentials,
};
