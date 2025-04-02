import { chromium } from '@playwright/test';

const username = 'juliancavero@hotmail.com';
const password = 'asterisco42mm?';

async function navigateToTikTokUpload(): Promise<void> {
  const browser = await chromium.launch({ headless: false });
  console.log('Browser launched');

  try {
    console.log('Username:', username, ' password', password);

    console.log('Creating a new page');
    const page = await browser.newPage();

    await page.goto('https://www.tiktok.com/login/phone-or-email/email');
    console.log('Navigated to TikTok login page');

    // Handle cookie consent dialog if it appears
    try {
      await page.waitForSelector('div.button-wrapper', { timeout: 5000 });
      console.log('Cookie consent dialog found');

      // Find all buttons within button-wrapper and click the first one
      const cookieButtons = await page.locator('div.button-wrapper button');
      const count = await cookieButtons.count();

      if (count >= 1) {
        await cookieButtons.first().click();
        console.log('Clicked the first button in cookie consent dialog');
        // Wait a moment for the dialog to disappear
        await page.waitForTimeout(2000);
      }
    } catch (e) {
      console.log('Cookie consent dialog not found or already handled');
    }

    // Wait for the login form to be fully loaded
    await page.waitForSelector('input[type="text"][name="username"]', {
      timeout: 10000,
    });
    console.log('Login form loaded');

    // Enter username
    await page.fill('input[type="text"][name="username"]', username);
    console.log('Username entered');

    // Enter password
    await page.fill('input[type="password"]', password);
    console.log('Password entered');

    // Find and click the submit button
    const submitButton = await page.locator('button[type="submit"]');
    await submitButton.click();
    console.log('Submit button clicked');

    // Wait a bit longer to see the result of the login attempt
    await new Promise((resolve) => setTimeout(resolve, 10000));

    console.log('Closing page and browser');
    await page.close();
  } catch (error) {
    console.error(`Error during browser automation: ${error.message}`);
    console.error(error);
  } finally {
    await browser.close();
    console.log('Browser closed successfully');
  }
}

// Self-executing async function
(async () => {
  console.log('Starting TikTok upload navigation script');
  await navigateToTikTokUpload();
  console.log('Script completed');
})();
