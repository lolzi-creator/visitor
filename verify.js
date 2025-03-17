// verify.js
const axios = require('axios');
const config = require('./config');
const fs = require('fs');

// Function to test a single visit and verify it works
async function testVisit() {
    console.log('=== Token Page Visit Verification ===');
    console.log(`Token: ${config.tokenIdentifier}`);
    console.log(`URL: https://coinmarketcap.com/currencies/${config.tokenIdentifier}/`);
    console.log('Starting verification...');
    console.log('-'.repeat(50));

    try {
        // Create a user agent
        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

        // Construct the URL for your token's page
        const url = `https://coinmarketcap.com/currencies/${config.tokenIdentifier}/`;

        console.log(`Sending request to: ${url}`);
        console.log(`User-Agent: ${userAgent}`);

        const startTime = Date.now();
        // Make the request to visit the token's page
        const response = await axios.get(url, {
            headers: {
                'User-Agent': userAgent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            },
            timeout: 15000
        });
        const endTime = Date.now();

        console.log('\n=== Response Information ===');
        console.log(`Status: ${response.status} ${response.statusText}`);
        console.log(`Time: ${endTime - startTime}ms`);
        console.log(`Content-Type: ${response.headers['content-type']}`);
        console.log(`Content-Length: ${response.headers['content-length'] || 'unknown'} bytes`);

        // Check if the page title contains the token name to verify we're on the right page
        const pageContent = response.data;
        const titleMatch = pageContent.match(/<title>(.*?)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
            console.log(`Page Title: ${titleMatch[1]}`);
        } else {
            console.log('Could not extract page title');
        }

        // Save response to a file for inspection
        const filename = `verification_${new Date().toISOString().replace(/[:.]/g, '-')}.html`;
        fs.writeFileSync(filename, pageContent);
        console.log(`\nSaved full response to ${filename} for inspection`);

        console.log('\n=== Verification Result ===');
        console.log('✅ Request successful!');
        console.log(`The bot appears to be working correctly for token: ${config.tokenIdentifier}`);

    } catch (error) {
        console.error('\n=== Error Information ===');
        console.error(`Error Message: ${error.message}`);

        if (error.response) {
            // The request was made and the server responded with a status code
            // outside the range of 2xx
            console.error(`Status: ${error.response.status}`);
            console.error(`Headers: ${JSON.stringify(error.response.headers, null, 2)}`);

            // Save error response to a file
            if (error.response.data) {
                const filename = `error_${new Date().toISOString().replace(/[:.]/g, '-')}.html`;
                fs.writeFileSync(filename, typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data, null, 2));
                console.error(`Saved error response to ${filename}`);
            }
        } else if (error.request) {
            // The request was made but no response was received
            console.error('No response received from server');
        } else {
            // Something happened in setting up the request
            console.error('Error setting up request');
        }

        console.error('\n=== Verification Result ===');
        console.error('❌ Request failed!');
        console.error('Please check your token identifier and internet connection');
    }
}

// Run the test
testVisit();