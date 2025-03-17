// index.js
const axios = require('axios');
const config = require('./config');
const ProxyManager = require('./proxy');

// Initialize proxy manager
const proxyManager = new ProxyManager();

// Counter for tracking requests
let requestCounter = 0;
let successCounter = 0;
let errorCounter = 0;

// Function to visit token page on CoinMarketCap
async function visitTokenPage() {
    try {
        // Create a unique user agent for each request to mimic different users
        const userAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${Math.floor(Math.random() * 15) + 90}.0.${Math.floor(Math.random() * 1000) + 4000}.${Math.floor(Math.random() * 100)} Safari/537.36`;

        // Get proxy configuration
        const proxyConfig = proxyManager.getProxyConfig();
        const proxyInfo = proxyConfig ? `Using proxy: ${proxyConfig.host}:${proxyConfig.port}` : 'No proxy used';

        // Construct the URL for your token's page
        const url = `https://coinmarketcap.com/currencies/${config.tokenIdentifier}/`;

        console.log(`[${new Date().toISOString()}] Attempting visit to ${url}`);
        console.log(`User-Agent: ${userAgent.substring(0, 30)}...`);
        console.log(proxyInfo);

        // Make the request to visit the token's page
        const requestConfig = {
            headers: {
                'User-Agent': userAgent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Pragma': 'no-cache',
                'Cache-Control': 'no-cache',
                // Add a referer to make it look like you're coming from Google or another site
                'Referer': 'https://www.google.com/'
            },
            // Timeout after 15 seconds
            timeout: 15000,
            // Allow downloading the full page content
            maxContentLength: 10485760 // 10MB limit
        };

        // Add proxy to config if available
        if (proxyConfig) {
            requestConfig.proxy = proxyConfig;
        }

        const response = await axios.get(url, requestConfig);

        // Increment counters
        requestCounter++;
        successCounter++;

        // Log success with more details
        console.log(`[${new Date().toISOString()}] Visit #${requestCounter} successful`);
        console.log(`Status: ${response.status}`);
        console.log(`Content-Type: ${response.headers['content-type']}`);
        console.log(`Response Size: ${response.headers['content-length'] || 'unknown'} bytes`);

        // Save the first 100 characters of the response to verify it's the right page
        const previewContent = typeof response.data === 'string'
            ? response.data.substring(0, 100).replace(/\n/g, ' ').trim()
            : 'Response is not a string';
        console.log(`Content Preview: ${previewContent}...`);

        // Log a separator for readability
        console.log('-'.repeat(50));

        return response.status;
    } catch (error) {
        // Increment counters
        requestCounter++;
        errorCounter++;

        // Log detailed error information
        console.error(`[${new Date().toISOString()}] Visit #${requestCounter} failed:`);
        console.error(`Error Message: ${error.message}`);

        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.error(`Status: ${error.response.status}`);
            console.error(`Headers: ${JSON.stringify(error.response.headers)}`);
        } else if (error.request) {
            // The request was made but no response was received
            console.error('No response received from server');
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error('Error setting up request:', error.message);
        }

        // Log a separator for readability
        console.error('-'.repeat(50));

        return null;
    }
}

// Function to run multiple visits in parallel
async function runBatch() {
    try {
        // Create an array of promises for concurrent visits
        const visits = Array(config.concurrentRequests).fill().map(() => visitTokenPage());

        // Wait for all visits to complete
        await Promise.all(visits);

        // Print statistics
        console.log(`\n--- Statistics ---`);
        console.log(`Total Visits: ${requestCounter}`);
        console.log(`Successful: ${successCounter}`);
        console.log(`Failed: ${errorCounter}`);
        console.log(`Success Rate: ${(successCounter / requestCounter * 100).toFixed(2)}%`);
        console.log(`-----------------\n`);

    } catch (error) {
        console.error(`Batch error: ${error.message}`);
    }
}

// Main function to start the bot
async function startBot() {
    console.log(`Starting token visibility bot for ${config.tokenIdentifier}...`);
    console.log(`Visiting token page every ${config.requestInterval / 1000} seconds with ${config.concurrentRequests} concurrent visits per batch`);
    console.log(`Press Ctrl+C to stop the bot\n`);

    // Run the first batch immediately
    await runBatch();

    // Set up interval for subsequent batches
    setInterval(runBatch, config.requestInterval);
}

// Start the bot
startBot().catch(error => {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
});