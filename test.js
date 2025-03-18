// coingecko-search-bot.js
require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const PROXIES = require('./proxies');

// Create a readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Configuration (with defaults from .env if available)
const config = {
    visitDelay: parseInt(process.env.VISIT_DELAY) || 5000,
    headless: process.env.HEADLESS !== 'false', // Default to true unless explicitly set to false
};

// Create directories if they don't exist
const logsDir = './logs';
const screenshotsBaseDir = './screenshots/coingecko';

if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

if (!fs.existsSync(screenshotsBaseDir)) {
    fs.mkdirSync(screenshotsBaseDir, { recursive: true });
}

// Track problematic proxies that trigger CAPTCHAs
const problematicProxies = new Set();

// Function to log results - only logs to file, not console
function logResult(result) {
    const logFile = `${logsDir}/coingecko-search-log.json`;
    let logs = [];

    // Read existing logs if available
    if (fs.existsSync(logFile)) {
        try {
            logs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
        } catch (e) {
            // Silent error
        }
    }

    // Add new log entry
    logs.push({
        timestamp: new Date().toISOString(),
        ...result
    });

    // Write updated logs
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
}

// Function to get a random proxy that avoids problematic ones
function getRandomProxy() {
    // Filter out proxies that have triggered CAPTCHAs recently
    const availableProxies = PROXIES.filter(proxy =>
        !problematicProxies.has(`${proxy.host}:${proxy.port}`)
    );

    // If we still have available proxies, use one of them
    if (availableProxies.length > 0) {
        return availableProxies[Math.floor(Math.random() * availableProxies.length)];
    }

    // If all proxies are problematic or we don't have enough, reset and try again
    // but with a warning
    if (problematicProxies.size > 0) {
        process.stdout.write(`⚠️ All proxies have triggered CAPTCHAs, resetting problematic list\n`);
        problematicProxies.clear();
    }

    return PROXIES[Math.floor(Math.random() * PROXIES.length)];
}

// Mark a proxy as problematic
function markProxyAsProblem(proxy) {
    const proxyKey = `${proxy.host}:${proxy.port}`;
    problematicProxies.add(proxyKey);
    process.stdout.write(`Marked proxy ${proxyKey} as problematic (triggered Cloudflare)\n`);
}

// Function for safe waiting - Fixing waitForTimeout issue
const safeWait = async (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

// Function to handle Cloudflare CAPTCHA challenges
async function handleCloudflareChallenge(page, sessionId) {
    try {
        // Check if we're on the Cloudflare verification page
        const isCloudflare = await page.evaluate(() => {
            // Look for common Cloudflare verification text
            const pageText = document.body.innerText;
            return pageText.includes('Verifying you are human') ||
                pageText.includes('Cloudflare') ||
                pageText.includes('Bestätigen Sie, dass Sie ein Mensch sind');
        });

        if (isCloudflare) {
            process.stdout.write(`[Session ${sessionId}] ⚠️ Cloudflare CAPTCHA detected\n`);

            // Check if there's a checkbox to click (I'm not a robot)
            const hasCheckbox = await page.evaluate(() => {
                return !!document.querySelector('input[type="checkbox"]');
            });

            if (hasCheckbox) {
                process.stdout.write(`[Session ${sessionId}] Found Cloudflare checkbox, attempting to click\n`);
                await page.click('input[type="checkbox"]');
                await safeWait(1500); // Use safeWait instead of waitForTimeout
            }

            // Wait for the verification to complete (which may happen automatically)
            process.stdout.write(`[Session ${sessionId}] Waiting for Cloudflare verification to complete...\n`);

            // Wait for automatic verification to complete
            await safeWait(5000);

            // Check if we're still on the verification page
            const stillOnVerification = await page.evaluate(() => {
                const pageText = document.body.innerText;
                return pageText.includes('Verifying you are human') ||
                    pageText.includes('Cloudflare') ||
                    pageText.includes('Bestätigen Sie, dass Sie ein Mensch sind');
            });

            if (!stillOnVerification) {
                process.stdout.write(`[Session ${sessionId}] ✅ Cloudflare verification passed automatically\n`);
                return true;
            }

            // Try to wait a bit longer
            process.stdout.write(`[Session ${sessionId}] Still on verification, waiting longer...\n`);
            await safeWait(5000);

            // Check again
            const finalCheck = await page.evaluate(() => {
                const pageText = document.body.innerText;
                return !pageText.includes('Verifying you are human') &&
                    !pageText.includes('Cloudflare') &&
                    !pageText.includes('Bestätigen Sie, dass Sie ein Mensch sind');
            });

            if (finalCheck) {
                process.stdout.write(`[Session ${sessionId}] ✅ Cloudflare verification eventually passed\n`);
                return true;
            } else {
                process.stdout.write(`[Session ${sessionId}] ❌ Cloudflare verification did not complete automatically\n`);
                return false;
            }
        }

        return true; // No Cloudflare detection
    } catch (error) {
        process.stdout.write(`[Session ${sessionId}] ❌ Error handling Cloudflare: ${error.message}\n`);
        return false;
    }
}

// Function to perform CoinGecko search and visit for a token
async function performSearch(sessionId, tokenName) {
    const proxy = getRandomProxy();

    // Create a unique directory for this search session's screenshots
    const timestamp = Date.now();
    const visitId = `search-s${sessionId}-${timestamp}`;
    const screenshotsDir = path.join(screenshotsBaseDir, visitId);
    fs.mkdirSync(screenshotsDir, { recursive: true });

    // Function to save screenshot with step name - silent
    const saveScreenshot = async (page, stepName) => {
        const screenshotPath = path.join(screenshotsDir, `${stepName}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });
        return screenshotPath;
    };

    let browser;
    let page;

    try {
        // Launch browser with proxy
        browser = await puppeteer.launch({
            headless: config.headless,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                `--proxy-server=http://${proxy.host}:${proxy.port}`
            ]
        });

        // Open a new page
        page = await browser.newPage();

        // Configure authentication for proxy
        await page.authenticate({
            username: proxy.username,
            password: proxy.password
        });

        // Set viewport for consistent screenshots
        await page.setViewport({
            width: 1366,
            height: 768
        });

        // Set a random user agent
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'
        ];
        const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
        await page.setUserAgent(userAgent);

        // Set referer to make it look like we're coming from Google
        await page.setExtraHTTPHeaders({
            'Referer': 'https://www.google.com/search?q=cryptocurrency+prices'
        });

        // Navigate to CoinGecko homepage
        process.stdout.write(`[Session ${sessionId}] Loading CoinGecko homepage...\n`);

        try {
            await page.goto('https://www.coingecko.com/', {
                waitUntil: 'networkidle2',
                timeout: 20000
            });

            await saveScreenshot(page, '01-homepage');

            // Check for Cloudflare CAPTCHA
            const cloudflareResult = await handleCloudflareChallenge(page, sessionId);
            if (!cloudflareResult) {
                markProxyAsProblem(proxy);

                // Try refreshing the page
                await page.reload({ waitUntil: 'networkidle2' });
                await safeWait(3000);

                // Check for Cloudflare again
                const secondCheck = await handleCloudflareChallenge(page, sessionId);
                if (!secondCheck) {
                    process.stdout.write(`[Session ${sessionId}] ❌ Failed to bypass Cloudflare\n`);
                    logResult({
                        sessionId,
                        success: false,
                        token: tokenName,
                        error: "Cloudflare CAPTCHA could not be bypassed",
                        proxy: `${proxy.host}:${proxy.port}`,
                        screenshots: screenshotsDir,
                        visitId: visitId
                    });
                    return false;
                }
            }

            // Handle cookie consent if it appears
            try {
                const cookieConsentExists = await page.evaluate(() => {
                    // Look for common cookie consent selectors
                    const selectors = [
                        'div[class*="cookie"]',
                        'div[id*="cookie"]',
                        'div[class*="consent"]',
                        'div[id*="consent"]',
                        'button[id*="accept"]',
                        'button[class*="accept"]'
                    ];

                    for (const selector of selectors) {
                        if (document.querySelector(selector)) {
                            return true;
                        }
                    }
                    return false;
                });

                if (cookieConsentExists) {
                    await saveScreenshot(page, '02-cookie-consent');

                    // Try to accept cookies
                    await page.evaluate(() => {
                        // Common accept button selectors
                        const acceptSelectors = [
                            'button[id*="accept"]',
                            'button[class*="accept"]',
                            'a[id*="accept"]',
                            'a[class*="accept"]',
                            'button:contains("Accept")',
                            'button:contains("Agree")',
                            'button:contains("OK")'
                        ];

                        for (const selector of acceptSelectors) {
                            const elements = document.querySelectorAll(selector);
                            for (const el of elements) {
                                if (el.innerText && (
                                    el.innerText.includes('Accept') ||
                                    el.innerText.includes('Agree') ||
                                    el.innerText.includes('OK')
                                )) {
                                    el.click();
                                    return true;
                                }
                            }
                        }

                        // If we can't find by text, just try the buttons
                        for (const selector of acceptSelectors) {
                            const el = document.querySelector(selector);
                            if (el) {
                                el.click();
                                return true;
                            }
                        }

                        return false;
                    });

                    await safeWait(1500);
                }
            } catch (e) {
                // Silent error handling
            }

            // Find and click on the search button/icon in the top navigation
            await saveScreenshot(page, '03-before-search');

            // Try clicking directly on the search icon in the header
            const searchIconClicked = await page.evaluate(() => {
                // Try the search icon in the header first
                const searchIcon = document.querySelector('a[href="/search"], .search-icon, button[aria-label="Search"], .header-search-button');
                if (searchIcon) {
                    searchIcon.click();
                    return true;
                }
                return false;
            });

            if (searchIconClicked) {
                await safeWait(1500);
                await saveScreenshot(page, '04-search-clicked');
            } else {
                // If we couldn't find the icon, try clicking the search bar div
                const searchBarClicked = await page.evaluate(() => {
                    const searchBar = document.querySelector('#search-bar, [data-search-v2-target="searchbar"], [data-action*="search-v2#showSearchPopup"]');
                    if (searchBar) {
                        searchBar.click();
                        return true;
                    }
                    return false;
                });

                if (searchBarClicked) {
                    await safeWait(1500);
                    await saveScreenshot(page, '04-search-bar-clicked');
                } else {
                    // As a last resort, try to find anything with search in its attributes
                    const anySearchClicked = await page.evaluate(() => {
                        const anySearch = document.querySelector('*[id*="search" i], *[class*="search" i], *[aria-label*="search" i]');
                        if (anySearch) {
                            anySearch.click();
                            return true;
                        }
                        return false;
                    });

                    if (anySearchClicked) {
                        await safeWait(1500);
                        await saveScreenshot(page, '04-generic-search-clicked');
                    } else {
                        process.stdout.write(`[Session ${sessionId}] ❌ Could not find search icon/button\n`);

                        // Try directly using the search URL
                        await page.goto(`https://www.coingecko.com/search?query=${encodeURIComponent(tokenName)}`, {
                            waitUntil: 'networkidle2'
                        });

                        await safeWait(2000);
                        await saveScreenshot(page, '04-direct-search-navigation');

                        // Now look for token in search results
                        const tokenFoundInSearchPage = await page.evaluate((tokenName) => {
                            const normalizedName = tokenName.toLowerCase().trim();
                            const links = Array.from(document.querySelectorAll('a'));

                            const relevantLinks = links.filter(link =>
                                link.textContent && link.textContent.toLowerCase().includes(normalizedName)
                            );

                            if (relevantLinks.length > 0) {
                                relevantLinks[0].click();
                                return true;
                            }

                            return false;
                        }, tokenName);

                        if (tokenFoundInSearchPage) {
                            await safeWait(3000);
                            await saveScreenshot(page, '05-token-page-from-search-url');

                            // Log success
                            process.stdout.write(`[Session ${sessionId}] ✅ Success via direct search URL\n`);
                            logResult({
                                sessionId,
                                success: true,
                                token: tokenName,
                                note: "Found via direct search URL",
                                proxy: `${proxy.host}:${proxy.port}`,
                                screenshots: screenshotsDir,
                                visitId: visitId
                            });

                            return true;
                        }

                        process.stdout.write(`[Session ${sessionId}] ❌ Failed to find search or token\n`);
                        logResult({
                            sessionId,
                            success: false,
                            token: tokenName,
                            error: "Could not find search icon/button or token",
                            proxy: `${proxy.host}:${proxy.port}`,
                            screenshots: screenshotsDir,
                            visitId: visitId
                        });

                        return false;
                    }
                }
            }

            // Look for search input after clicking search
            const searchInputFound = await page.evaluate(() => {
                const inputSelectors = [
                    'input[type="search"]',
                    'input[type="text"]',
                    'input[placeholder*="search" i]',
                    'input[placeholder*="suchen" i]',
                    'input[id*="search" i]',
                    'input[class*="search" i]'
                ];

                for (const selector of inputSelectors) {
                    const input = document.querySelector(selector);
                    if (input && input.offsetParent !== null) {
                        input.focus();
                        return true;
                    }
                }

                // Try all visible inputs as last resort
                const allInputs = document.querySelectorAll('input');
                for (const input of allInputs) {
                    if (input.offsetParent !== null) {
                        input.focus();
                        return true;
                    }
                }

                return false;
            });

            if (searchInputFound) {
                await safeWait(1000);
                await saveScreenshot(page, '05-search-input-found');

                // Clear any existing text
                await page.keyboard.down('Control');
                await page.keyboard.press('a');
                await page.keyboard.up('Control');
                await page.keyboard.press('Backspace');

                // Type the token name slowly like a human
                for (const char of tokenName) {
                    await page.keyboard.type(char);
                    await safeWait(Math.floor(Math.random() * 100)); // Type faster
                }

                await safeWait(1000);
                await saveScreenshot(page, '06-search-term-entered');

                // Look for search results that appear as you type
                const resultClicked = await page.evaluate((searchTerm) => {
                    const normalizedTerm = searchTerm.toLowerCase().trim();

                    // First look for dropdown results that appear as you type
                    const resultElements = document.querySelectorAll('.search-results a, .search-result a, [role="option"] a, .autocomplete-suggestion a, a[href*="/coins/"]');

                    const matches = Array.from(resultElements).filter(el =>
                        el.textContent && el.textContent.toLowerCase().includes(normalizedTerm)
                    );

                    if (matches.length > 0) {
                        matches[0].click();
                        return true;
                    }

                    // If no matches in dropdown, return false to press Enter later
                    return false;
                }, tokenName);

                if (resultClicked) {
                    await safeWait(3000);
                    await saveScreenshot(page, '07-token-page-loading');

                    // Check if we landed on a token page
                    const onTokenPage = await page.evaluate(() => {
                        return window.location.href.includes('/coins/') ||
                            window.location.href.includes('/currencies/');
                    });

                    if (onTokenPage) {
                        // Simulate reading - do a quick scroll
                        await page.evaluate(() => {
                            window.scrollBy(0, 500);
                        });

                        await safeWait(1000);
                        await saveScreenshot(page, '08-token-page-scrolled');

                        // Log success
                        process.stdout.write(`[Session ${sessionId}] ✅ Success via dropdown search\n`);
                        logResult({
                            sessionId,
                            success: true,
                            token: tokenName,
                            note: "Found via dropdown search results",
                            proxy: `${proxy.host}:${proxy.port}`,
                            screenshots: screenshotsDir,
                            visitId: visitId
                        });

                        return true;
                    }
                } else {
                    // No matching result in dropdown, press Enter to do a full search
                    await page.keyboard.press('Enter');
                    await safeWait(2500);
                    await saveScreenshot(page, '07-search-results-page');

                    // Look for token in search results page
                    const tokenFoundInResults = await page.evaluate((tokenName) => {
                        const normalizedName = tokenName.toLowerCase().trim();
                        const links = Array.from(document.querySelectorAll('a'));

                        const relevantLinks = links.filter(link =>
                            link.textContent && link.textContent.toLowerCase().includes(normalizedName)
                        );

                        if (relevantLinks.length > 0) {
                            relevantLinks[0].click();
                            return true;
                        }

                        return false;
                    }, tokenName);

                    if (tokenFoundInResults) {
                        await safeWait(3000);
                        await saveScreenshot(page, '08-token-page-from-results');

                        // Log success
                        process.stdout.write(`[Session ${sessionId}] ✅ Success via Enter search\n`);
                        logResult({
                            sessionId,
                            success: true,
                            token: tokenName,
                            note: "Found via Enter key search results",
                            proxy: `${proxy.host}:${proxy.port}`,
                            screenshots: screenshotsDir,
                            visitId: visitId
                        });

                        return true;
                    }
                }
            }

            // If we get here, the search process was unsuccessful
            process.stdout.write(`[Session ${sessionId}] ❌ Failed: search process unsuccessful\n`);
            logResult({
                sessionId,
                success: false,
                token: tokenName,
                error: "Could not complete search process",
                proxy: `${proxy.host}:${proxy.port}`,
                screenshots: screenshotsDir,
                visitId: visitId
            });

            return false;
        } catch (error) {
            process.stdout.write(`[Session ${sessionId}] Error loading page: ${error.message}\n`);
            // Continue to error handling below
        }

        // If we get here, something went wrong
        process.stdout.write(`[Session ${sessionId}] ❌ Error: Failed to load CoinGecko or perform search\n`);
        logResult({
            sessionId,
            success: false,
            token: tokenName,
            error: "Failed to load CoinGecko or perform search",
            proxy: `${proxy.host}:${proxy.port}`,
            screenshots: screenshotsDir,
            visitId: visitId
        });

        return false;
    } catch (error) {
        process.stdout.write(`[Session ${sessionId}] ❌ Error: ${error.message}\n`);

        // Try to save error screenshot if possible
        try {
            if (page) {
                const errorScreenshotPath = path.join(screenshotsDir, 'error.png');
                await page.screenshot({ path: errorScreenshotPath, fullPage: false });
            }
        } catch (screenshotError) {
            // Silent error
        }

        logResult({
            sessionId,
            success: false,
            token: tokenName,
            error: error.message,
            proxy: `${proxy.host}:${proxy.port}`,
            screenshots: screenshotsDir,
            visitId: visitId
        });

        return false;
    } finally {
        // Close the browser
        if (browser) {
            await browser.close();
        }
    }
}

// Function to run concurrent searches
async function runConcurrentSearches(tokenName, batchSize) {
    process.stdout.write(`\nStarting batch of ${batchSize} sessions...\n`);

    // Create array of search promises
    const searchPromises = [];
    for (let i = 0; i < batchSize; i++) {
        searchPromises.push(performSearch(i + 1, tokenName));
    }

    // Wait for all searches to complete
    const results = await Promise.all(searchPromises);

    // Count successes
    const successCount = results.filter(result => result).length;

    process.stdout.write(`Batch completed: ${successCount}/${batchSize} successful\n`);

    return successCount;
}

// Main function to run searches
async function main() {
    console.log("=== CoinGecko Search Bot ===");

    // Prompt user for token name
    rl.question('Enter the token name to search for: ', (tokenName) => {
        if (!tokenName || tokenName.trim() === '') {
            console.log('Please provide a valid token name.');
            rl.close();
            return;
        }

        tokenName = tokenName.trim();

        // Prompt for total number of sessions
        rl.question('Enter the total number of sessions to run: ', (totalSessionsInput) => {
            // Validate and parse the total number of sessions
            const totalSessions = parseInt(totalSessionsInput.trim());

            if (isNaN(totalSessions) || totalSessions <= 0) {
                console.log('Please provide a valid number of sessions.');
                rl.close();
                return;
            }

            // Prompt for concurrent sessions (batch size)
            rl.question('Enter the number of concurrent sessions per batch: ', async (concurrentSessionsInput) => {
                // Validate and parse concurrent sessions
                const concurrentSessions = parseInt(concurrentSessionsInput.trim());

                if (isNaN(concurrentSessions) || concurrentSessions <= 0) {
                    console.log('Please provide a valid number of concurrent sessions.');
                    rl.close();
                    return;
                }

                // Make sure concurrentSessions doesn't exceed totalSessions
                const actualConcurrentSessions = Math.min(concurrentSessions, totalSessions);

                console.log(`\n=== CONFIGURATION ===`);
                console.log(`Token to search: ${tokenName}`);
                console.log(`Total sessions: ${totalSessions}`);
                console.log(`Concurrent sessions per batch: ${actualConcurrentSessions}`);
                console.log(`Running in ${config.headless ? 'headless' : 'visible'} browser mode`);

                const startTime = Date.now();
                let completedSessions = 0;
                let successfulSessions = 0;

                // Calculate how many batches we need
                const batches = Math.ceil(totalSessions / actualConcurrentSessions);

                for (let i = 0; i < batches; i++) {
                    // For the last batch, we might need fewer than concurrentSessions
                    const remainingSessions = totalSessions - completedSessions;
                    const batchSize = Math.min(actualConcurrentSessions, remainingSessions);

                    const batchSuccesses = await runConcurrentSearches(tokenName, batchSize);

                    completedSessions += batchSize;
                    successfulSessions += batchSuccesses;

                    // If this is not the final batch, add a delay between batches
                    if (i < batches - 1) {
                        const batchDelay = config.visitDelay + Math.floor(Math.random() * 2000);
                        process.stdout.write(`Waiting ${(batchDelay/1000).toFixed(1)} seconds before next batch...\n`);
                        await new Promise(r => setTimeout(r, batchDelay));
                    }
                }

                // Calculate statistics
                const endTime = Date.now();
                const totalTimeMin = ((endTime - startTime) / 60000).toFixed(2);

                console.log(`\n=== CAMPAIGN COMPLETED ===`);
                console.log(`Token searched: ${tokenName}`);
                console.log(`Total sessions run: ${completedSessions}`);
                console.log(`Successful: ${successfulSessions}`);
                console.log(`Failed: ${completedSessions - successfulSessions}`);
                console.log(`Success rate: ${(successfulSessions/completedSessions*100).toFixed(2)}%`);
                console.log(`Total runtime: ${totalTimeMin} minutes`);

                // Close readline interface
                rl.close();
            });
        });
    });
}

// Run the main function
main().catch(error => {
    console.error(`Fatal error: ${error.message}`);
    rl.close();
    process.exit(1);
});