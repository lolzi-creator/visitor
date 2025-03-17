// browser-mode.js
require('dotenv').config();
const BrowserVisitor = require('./browser');
const ProxyManager = require('./proxy');
const config = require('./config');

// Initialize classes
const browser = new BrowserVisitor();
const proxyManager = new ProxyManager();

// Counters
let visitCounter = 0;
let successCounter = 0;
let errorCounter = 0;
let blockedCounter = 0;

// Function to visit using the browser
async function browserVisit() {
    // Get proxy if available, but don't require it
    const proxyConfig = proxyManager.getNextProxy();
    const url = `https://coinmarketcap.com/currencies/${config.tokenIdentifier}/`;

    visitCounter++;
    console.log(`\n[${new Date().toISOString()}] Browser visit #${visitCounter} starting`);
    console.log(`Visiting: ${url}`);
    console.log(`Proxy: ${proxyConfig ? 'Using proxy' : 'No proxy'}`);

    try {
        const result = await browser.visitPage(url, {
            userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${Math.floor(Math.random() * 15) + 90}.0.${Math.floor(Math.random() * 1000) + 4000}.${Math.floor(Math.random() * 100)} Safari/537.36`,
            proxyServer: proxyConfig, // This will be null if no proxies are available
            scrollPage: config.scrollPage,
            interactWithPage: config.interactWithPage
        });

        if (result.success) {
            successCounter++;

            if (result.isBlocked) {
                blockedCounter++;
                console.log(`✖️ Visit #${visitCounter} shows signs of being blocked/rate limited`);
            } else if (result.isTokenPage) {
                console.log(`✅ Visit #${visitCounter} successfully verified token page`);

                // Track token info over time
                const timestamp = new Date().toISOString();
                console.log(`\n--- Token Info at ${timestamp} ---`);
                if (result.tokenInfo.name) console.log(`Name: ${result.tokenInfo.name}`);
                if (result.tokenInfo.price) console.log(`Price: ${result.tokenInfo.price}`);
                if (result.tokenInfo.marketCap) console.log(`Market Cap: ${result.tokenInfo.marketCap}`);
                if (result.tokenInfo.rank) console.log(`Rank: ${result.tokenInfo.rank}`);
                console.log('----------------------------\n');

                // You could save this info to a file to track changes over time
            } else {
                console.log(`⚠️ Visit #${visitCounter} completed but token page verification failed`);
            }
        } else {
            errorCounter++;
            console.error(`✖️ Visit #${visitCounter} failed: ${result.error}`);
        }

        return result;
    } catch (error) {
        errorCounter++;
        console.error(`✖️ Visit #${visitCounter} failed with error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// Function to run a batch of browser visits
async function runBrowserBatch(batchSize = 1) {
    try {
        console.log(`\n=== Starting batch of ${batchSize} browser visits ===`);

        // Run visits sequentially (browser visits should not be parallel)
        for (let i = 0; i < batchSize; i++) {
            await browserVisit();

            // Add a random delay between visits
            if (i < batchSize - 1) {
                const delay = 3000 + Math.floor(Math.random() * 7000);
                console.log(`Waiting ${delay}ms before next visit...`);
                await new Promise(r => setTimeout(r, delay));
            }
        }

        // Print statistics
        console.log(`\n=== Batch Statistics ===`);
        console.log(`Total Visits: ${visitCounter}`);
        console.log(`Successful: ${successCounter}`);
        console.log(`Failed: ${errorCounter}`);
        console.log(`Blocked: ${blockedCounter}`);
        console.log(`Success Rate: ${(successCounter / visitCounter * 100).toFixed(2)}%`);
        console.log(`Block Rate: ${(blockedCounter / successCounter * 100).toFixed(2)}%`);
        console.log(`========================\n`);

    } catch (error) {
        console.error(`Batch error: ${error.message}`);
    }
}

// Main function
async function main() {
    try {
        console.log(`Starting browser-based token visibility bot for ${config.tokenIdentifier}...`);
        console.log(`Token URL: https://coinmarketcap.com/currencies/${config.tokenIdentifier}/`);
        console.log(`Press Ctrl+C to stop the bot\n`);

        // Initialize the browser
        await browser.initialize();

        // Run the first batch immediately
        await runBrowserBatch(config.concurrentRequests);

        // Set up interval for subsequent batches
        const interval = setInterval(async () => {
            await runBrowserBatch(config.concurrentRequests);
        }, config.requestInterval);

        // Handle shutdown
        process.on('SIGINT', async () => {
            console.log('\nShutting down browser bot...');
            clearInterval(interval);
            await browser.close();
            console.log('Browser bot has been stopped');
            process.exit(0);
        });

    } catch (error) {
        console.error(`Fatal error: ${error.message}`);
        await browser.close();
        process.exit(1);
    }
}

// Start the main function
main().catch(async error => {
    console.error(`Unhandled error: ${error.message}`);
    await browser.close();
    process.exit(1);
});