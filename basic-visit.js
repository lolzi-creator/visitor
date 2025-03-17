// basic-visit.js
require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs');

// Get the token identifier from .env file
const tokenIdentifier = process.env.TOKEN_IDENTIFIER || 'distribute';
const visitCount = parseInt(process.env.VISIT_COUNT) || 3;
const visitDelay = parseInt(process.env.VISIT_DELAY) || 10000; // 10 seconds between visits

// Function to log results
function logResult(result) {
    const logFile = 'visit-log.json';
    let logs = [];

    // Read existing logs if available
    if (fs.existsSync(logFile)) {
        try {
            logs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
        } catch (e) {
            console.error('Error reading log file:', e);
        }
    }

    // Add new log entry
    logs.push({
        timestamp: new Date().toISOString(),
        ...result
    });

    // Write updated logs
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
    console.log(`Log saved to ${logFile}`);
}

// Simple function to visit a page with Puppeteer
async function visitPage() {
    console.log(`\n=== TOKEN VISIBILITY VISIT ===`);
    console.log(`Token: ${tokenIdentifier}`);
    console.log(`URL: https://coinmarketcap.com/currencies/${tokenIdentifier}/`);
    console.log(`Time: ${new Date().toISOString()}`);

    // Launch browser
    console.log('\nLaunching browser...');
    const browser = await puppeteer.launch({
        headless: true,  // Change to false to see the browser window
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        // Open a new page
        const page = await browser.newPage();

        // Set a random user agent
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'
        ];
        const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
        await page.setUserAgent(userAgent);
        console.log(`Using user agent: ${userAgent.substring(0, 30)}...`);

        // Set referer to make it look like we're coming from Google
        await page.setExtraHTTPHeaders({
            'Referer': 'https://www.google.com/search?q=cryptocurrency+token+distribute'
        });

        // Navigate to the URL
        console.log('Visiting page...');
        const startTime = Date.now();
        await page.goto(`https://coinmarketcap.com/currencies/${tokenIdentifier}/`, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        const loadTime = Date.now() - startTime;
        console.log(`Page loaded in ${loadTime}ms`);

        // Get the page title
        const title = await page.title();
        console.log(`Page title: ${title}`);

        // Scroll down the page
        console.log('Scrolling page...');
        await page.evaluate(() => {
            return new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    if (totalHeight >= document.body.scrollHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });

        // Take a screenshot
        const screenshotPath = `visit-${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: false });
        console.log(`Screenshot saved to ${screenshotPath}`);

        // Log success
        console.log('\n✅ VISIT SUCCESSFUL');
        logResult({
            success: true,
            title,
            loadTime,
            screenshot: screenshotPath
        });

        return true;
    } catch (error) {
        console.error(`\n❌ ERROR: ${error.message}`);
        logResult({
            success: false,
            error: error.message
        });
        return false;
    } finally {
        // Close the browser
        await browser.close();
        console.log('Browser closed');
    }
}

// Run multiple visits
async function runVisits() {
    console.log(`Starting ${visitCount} visits to increase token visibility`);
    console.log(`Token: ${tokenIdentifier}`);
    console.log(`Delay between visits: ${visitDelay}ms`);

    let successCount = 0;

    for (let i = 0; i < visitCount; i++) {
        console.log(`\nRunning visit ${i+1} of ${visitCount}`);

        if (await visitPage()) {
            successCount++;
        }

        if (i < visitCount - 1) {
            // Wait between visits
            console.log(`Waiting ${visitDelay/1000} seconds before next visit...`);
            await new Promise(resolve => setTimeout(resolve, visitDelay));
        }
    }

    console.log(`\n=== VISIT CAMPAIGN COMPLETED ===`);
    console.log(`Total visits: ${visitCount}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${visitCount - successCount}`);
    console.log(`Success rate: ${(successCount/visitCount*100).toFixed(2)}%`);
}

// Run the visits
runVisits().catch(console.error);