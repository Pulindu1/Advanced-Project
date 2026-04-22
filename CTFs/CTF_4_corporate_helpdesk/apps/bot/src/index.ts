import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { chromium, Browser, Page } from 'playwright';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const BOT_BASE_URL = process.env.BOT_BASE_URL || 'http://localhost:5174';
const BOT_API_URL = process.env.BOT_API_URL || 'http://localhost:4001';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin_secure_password_123';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

let browser: Browser | null = null;

async function initBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browser;
}

async function loginAsAdmin(page: Page) {
  console.log('🔐 Logging in as admin...');
  
  try {
    console.log(`📍 Navigating to ${BOT_BASE_URL}/login`);
    await page.goto(`${BOT_BASE_URL}/login`, { timeout: 15000 });
    console.log('✅ Page loaded');
    
    // Log page title and URL for debugging
    const title = await page.title();
    const url = page.url();
    console.log(`📄 Page title: "${title}"`);
    console.log(`🔗 Current URL: ${url}`);
    
    // Get page content for debugging
    const content = await page.content();
    if (content.includes('input')) {
      console.log('✅ Page contains input elements');
    } else {
      console.log('❌ Page does NOT contain input elements');
      console.log('📄 First 500 chars of content:', content.substring(0, 500));
    }
    
    console.log('🔍 Looking for username input...');
    await page.waitForSelector('input#username', { timeout: 5000 });
    console.log('✅ Found username input');
    
    await page.fill('input#username', ADMIN_USERNAME);
    await page.fill('input#password', ADMIN_PASSWORD);
    console.log(`🔑 Filled credentials: ${ADMIN_USERNAME}`);
    
    await page.click('button[type="submit"]');
    console.log('👆 Clicked submit button, waiting for navigation...');
    
    // Wait a moment for any error messages to appear
    await page.waitForTimeout(2000);
    
    // Wait for navigation to complete
    try {
      await page.waitForURL(/\/dashboard/, { timeout: 10000 });
      console.log('✅ Admin logged in successfully');
    } catch (error: any) {
      const currentUrl = page.url();
      console.log(`❌ Navigation timeout. Current URL: ${currentUrl}`);
      
      // Check if there's an error message on the page
      const pageText = await page.textContent('body');
      if (pageText) {
        if (pageText.includes('Invalid') || pageText.includes('failed') || pageText.includes('error')) {
          console.log(`❌ Error message found: ${pageText.substring(0, 200)}`);
        } else {
          console.log(`📄 No obvious error message. Body text: ${pageText.substring(0, 300)}`);
        }
      }
      throw error;
    }
  } catch (error: any) {
    console.error('❌ Login failed:', error.message);
    throw error;
  }
}

async function visitReportedUrl(reportId: number, url: string) {
  console.log(`\n🤖 Processing report #${reportId}`);
  console.log(`📍 URL: ${url}`);

  let resolvedUrl = url;
  const consoleLogs: string[] = [];

  try {
    // Replace localhost URLs with internal service name
    resolvedUrl = url
      .replace('http://localhost:5173', BOT_BASE_URL)
      .replace('http://localhost:5174', BOT_BASE_URL);
    
    // Append reportId as query parameter so XSS can access it.
    // Accept relative paths (e.g. "/kb?search=...") by resolving against
    // BOT_BASE_URL — matches how the API's report validator parses URLs.
    const urlObj = new URL(resolvedUrl, BOT_BASE_URL);
    urlObj.searchParams.set('_reportId', reportId.toString());
    resolvedUrl = urlObj.toString();
    
    console.log(`🔀 Resolved URL: ${resolvedUrl}`);
    if (!urlObj.pathname.startsWith('/kb')) {
      throw new Error('Invalid URL: must be a KB path');
    }

    // Initialize browser with fixed viewport for determinism
    const browser = await initBrowser();
    const context = await browser.newContext({
      userAgent: 'IntraDesk Review Bot/1.0 (Moderator)',
      viewport: { width: 1280, height: 720 }, // Fixed viewport
    });
    const page = await context.newPage();
    
    // Capture page console messages
    page.on('console', (msg) => {
      const entry = `[${msg.type()}] ${msg.text()}`;
      console.log(`🖥️  Browser console:`, entry);
      consoleLogs.push(entry);
    });
    
    // Log network requests for debugging
    page.on('request', (request) => {
      if (request.url().includes('api') || request.url().includes('login')) {
        console.log(`🌐 Request: ${request.method()} ${request.url()}`);
      }
    });
    
    page.on('response', async (response) => {
      if (response.url().includes('api') || response.url().includes('login')) {
        console.log(`📡 Response: ${response.status()} ${response.url()}`);
        if (response.status() >= 400) {
          const text = await response.text().catch(() => 'Unable to read response');
          console.log(`❌ Error response body: ${text.substring(0, 200)}`);
        }
      }
    });
    
    // Intercept all requests to fix Host header for Vite
    await page.route('**/*', async (route) => {
      const headers = route.request().headers();
      headers['host'] = 'localhost:5173';
      await route.continue({ headers });
    });

    // Login as admin first
    await loginAsAdmin(page);

    // Visit the reported URL
    console.log(`🔍 Visiting reported URL...`);
    await page.goto(resolvedUrl, { waitUntil: 'domcontentloaded', timeout: 8000 });

    // Wait for JavaScript to execute (allows XSS payloads to run)
    console.log(`⏱️  Waiting 4s for JavaScript execution...`);
    await page.waitForTimeout(4000);

    // Debug: Check what's in the h2 element
    const h2Content = await page.$eval('h2', el => el.innerHTML).catch(() => 'H2 NOT FOUND');
    console.log(`� h2 content:`, h2Content);
    
    // Debug: Check if img tag exists
    const imgCount = await page.$$eval('img', imgs => imgs.length).catch(() => 0);
    console.log(`🖼️  Number of img tags found: ${imgCount}`);

    console.log('✅ Visit completed successfully');

    // Update report status to visited with timestamp
    await axios.put(`${BOT_API_URL}/api/report/internal/update/${reportId}`, {
      status: 'visited',
      visited_url: resolvedUrl,
      console_logs: consoleLogs.join('\n') || null,
    }).catch(err => {
      console.error('Failed to update report status:', err.message);
    });

    // Close context
    await context.close();

    return { success: true };
  } catch (error: any) {
    console.error('❌ Bot error for report #' + reportId + ':', error.message);
    console.error('Error type:', error.constructor.name);
    if (error.stack) {
      console.error('Stack trace:', error.stack.split('\n').slice(0, 3).join('\n'));
    }

    // Update report status to error with error message
    try {
      await axios.put(`${BOT_API_URL}/api/report/internal/update/${reportId}`, {
        status: 'error',
        error: error.message,
        visited_url: resolvedUrl || null,
        console_logs: consoleLogs.join('\n') || null,
      }).catch(() => {});
    } catch (e) {
      // Ignore
    }

    return { success: false, error: error.message };
  }
}

async function getCookies(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}

// Create worker
const worker = new Worker(
  'reports',
  async (job) => {
    const { reportId, url } = job.data;
    return await visitReportedUrl(reportId, url);
  },
  {
    connection,
    concurrency: 1, // Process one report at a time
  }
);

worker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});

console.log('🤖 Bot worker started and waiting for reports...');
console.log(`📍 Base URL: ${BOT_BASE_URL}`);
console.log(`🔗 API URL: ${BOT_API_URL}`);

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down worker...');
  await worker.close();
  if (browser) {
    await browser.close();
  }
  await connection.quit();
  process.exit(0);
});
