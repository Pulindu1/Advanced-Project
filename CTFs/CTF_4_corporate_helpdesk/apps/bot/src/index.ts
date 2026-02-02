import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { chromium, Browser, Page } from 'playwright';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const BOT_BASE_URL = process.env.BOT_BASE_URL || 'http://localhost:5174';
const BOT_API_URL = process.env.BOT_API_URL || 'http://localhost:4001';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@intradesk.local';
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
  
  await page.goto(`${BOT_BASE_URL}/login`);
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  
  // Wait for navigation to complete
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });
  
  console.log('✅ Admin logged in successfully');
}

async function visitReportedUrl(reportId: number, url: string) {
  console.log(`\n🤖 Processing report #${reportId}`);
  console.log(`📍 URL: ${url}`);
  
  try {
    // Validate URL
    const urlObj = new URL(url, BOT_BASE_URL);
    if (!urlObj.pathname.startsWith('/kb')) {
      throw new Error('Invalid URL: must be a KB path');
    }

    // Initialize browser
    const browser = await initBrowser();
    const context = await browser.newContext({
      userAgent: 'IntraDesk Review Bot/1.0 (Moderator)',
    });
    const page = await context.newPage();

    // Login as admin first
    await loginAsAdmin(page);

    // Visit the reported URL
    console.log(`🔍 Visiting reported URL...`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });

    // Wait for any JavaScript to execute
    await page.waitForTimeout(3000);

    console.log('✅ Visit completed');

    // Update report status
    await axios.put(`${BOT_API_URL}/api/admin/reports/${reportId}`, {
      status: 'visited',
    }, {
      headers: {
        'Cookie': await getCookies(page),
      },
    }).catch(err => {
      console.error('Failed to update report status:', err.message);
    });

    // Close context
    await context.close();

    return { success: true };
  } catch (error: any) {
    console.error('❌ Error visiting URL:', error.message);

    // Update report status to error
    try {
      await axios.put(`${BOT_API_URL}/api/admin/reports/${reportId}`, {
        status: 'error',
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
