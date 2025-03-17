// fixed-proxy-visit.js
require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs');

// Get the token identifier from .env file
const tokenIdentifier = process.env.TOKEN_IDENTIFIER || 'distribute';
const visitCount = parseInt(process.env.VISIT_COUNT) || 3;
const visitDelay = parseInt(process.env.VISIT_DELAY) || 10000; // 10 seconds between visits

// Hardcoded proxies from webshare with authentication
const PROXIES = [
    {
        host: "2.57.20.183",
        port: "6175",
        username: "amgrhbto",
        password: "utm9h7xxzuoa"
    },
    {
        host: "31.58.23.77",
        port: "5650",
        username: "amgrhbto",
        password: "utm9h7xxzuoa"
    },
    {
        host: "103.37.181.180",
        port: "6836",
        username: "amgrhbto",
        password: "utm9h7xxzuoa"
    },
    {
        host: "92.112.174.67",
        port: "5651",
        username: "amgrhbto",
        password: "utm9h7xxzuoa"
    },
    {
        host: "31.58.30.208",
        port: "6790",
        username: "amgrhbto",
        password: "utm9h7xxzuoa"
    },
    {
        host: "185.15.178.83",
        port: "5767",
        username: "amgrhbto",
        password: "utm9h7xxzuoa"
    },
    {
        host: "109.196.163.163",
        port: "6261",
        username: "amgrhbto",
        password: "utm9h7xxzuoa"
    },
    {
        host: "81.21.234.148",
        port: "6537",
        username: "amgrhbto",
        password: "utm9h7xxzuoa"
    },
    {
        host: "104.239.105.178",
        port: "6708",
        username: "amgrhbto",
        password: "utm9h7xxzuoa"
    },
    {
        host: "161.123.93.54",
        port: "5784",
        username: "amgrhbto",
        password: "utm9h7xxzuoa"
    },
    {
        host: "142.111.48.200",
        port: "6977",
        username: "amgrhbto",
        password: "utm9h7xxzuoa"
    },
    {
        host: "31.58.19.121",
        port: "6393",
        username: "amgrhbto",
        password: "utm9h7xxzuoa"
    },
    {
        host: "145.223.44.48",
        port: "5731",
        username: "amgrhbto",
        password: "utm9h7xxzuoa"
    },
    {
        host: "103.251.223.100",
        port: "6079",
        username: "amgrhbto",
        password: "utm9h7xxzuoa"
    },
    {
        host: "142.202.254.119",
        port: "6097",
        username: "amgrhbto",
        password: "utm9h7xxzuoa"
    },
    {
        host: "45.39.35.111",
        port: "5544",
        username: "amgrhbto",
        password: "utm9h7xxzuoa"
    },
    {
        host: "45.43.191.48",
        port: "6009",
        username: "amgrhbto",
        password: "utm9h7xxzuoa"
    },
    {
        host: "198.37.118.85",
        port: "5544",
        username: "amgrhbto",
        password: "utm9h7xxzuoa"
    },
    {
        host: "185.101.253.17",
        port: "5577",
        username: "amgrhbto",
        password: "utm9h7xxzuoa"
    },
    {
        host: "107.181.150.84",
        port: "5833",
        username: "amgrhbto",
        password: "utm9h7xxzuoa"
    }
];

// Function to get a random proxy
function getRandomProxy() {
    return PROXIES[Math.floor(Math.random() * PROXIES.length)];
}

// Function to log results
function logResult(result) {
    // Create logs directory if it doesn't exist
    const logsDir = './logs';
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }

    const logFile = `${logsDir}/visit-log.json`;
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
    const proxy = getRandomProxy();

    // Create a unique directory for this visit's screenshots
    const timestamp = Date.now();
    const visitId = `visit-${timestamp}`;
    const screenshotsDir = `./screenshots/${visitId}`;
    fs.mkdirSync(screenshotsDir, { recursive: true });

    console.log(`\n=== TOKEN VISIBILITY VISIT ===`);
    console.log(`Visit ID: ${visitId}`);
    console.log(`Token: ${tokenIdentifier}`);
    console.log(`URL: https://coinmarketcap.com/currencies/${tokenIdentifier}/`);
    console.log(`Time: ${new Date().toISOString()}`);
    console.log(`Using proxy: ${proxy.host}:${proxy.port}`);
    console.log(`Screenshots will be saved to: ${screenshotsDir}`);

    // Function to save screenshot with step name
    const saveScreenshot = async (page, stepName) => {
        const screenshotPath = `${screenshotsDir}/${stepName}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: false });
        console.log(`Screenshot saved: ${screenshotPath}`);
        return screenshotPath;
    };

    // Function for safe waiting
    const safeWait = async (ms) => {
        return new Promise(resolve => setTimeout(resolve, ms));
    };

    let browser;
    let page;

    try {
        // Launch browser with proxy
        console.log('\nLaunching browser...');
        browser = await puppeteer.launch({
            headless: true,  // Change to false to see the browser window
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

        // Configure proxy
        await page.setExtraHTTPHeaders({
            'Proxy-Authorization': `Basic ${Buffer.from(`${proxy.username}:${proxy.password}`).toString('base64')}`
        });

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

        // Navigate to the page
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

        // Take initial screenshot
        await saveScreenshot(page, '01-initial-load');

        // Accept cookies if the banner is present
        console.log('Checking for cookie consent banner...');
        try {
            // First check if the bottom cookie banner exists
            const bottomBannerSelector = '.cLyNAm, .cmc-cookie-policy-banner';
            const hasBottomBanner = await page.evaluate((sel) => {
                return !!document.querySelector(sel);
            }, bottomBannerSelector);

            if (hasBottomBanner) {
                console.log('Found bottom cookie banner');
                // Look for "Accept Cookies and Continue" button
                const acceptButtonSelectors = [
                    'button:contains("Accept Cookies and Continue")',
                    'button:contains("Accept")',
                    '.cLyNAm button',
                    '.cmc-cookie-policy-banner button'
                ];

                for (const selector of acceptButtonSelectors) {
                    const buttonText = selector.includes(':contains') ?
                        selector.match(/:contains\("(.+?)"\)/)[1] :
                        'Accept button';

                    const hasButton = await page.evaluate((sel, buttonText) => {
                        // If it's a contains selector
                        if (sel.includes(':contains(')) {
                            const text = buttonText;
                            const buttons = Array.from(document.querySelectorAll('button'));
                            const button = buttons.find(b => b.textContent.includes(text));
                            if (button) {
                                button.click();
                                return true;
                            }
                        } else {
                            // Regular selector
                            const button = document.querySelector(sel);
                            if (button) {
                                button.click();
                                return true;
                            }
                        }
                        return false;
                    }, selector, buttonText);

                    if (hasButton) {
                        console.log(`Clicked "${buttonText}" on bottom banner`);
                        await safeWait(1000);
                        await saveScreenshot(page, '02-bottom-cookies-accepted');
                        break;
                    }
                }
            }

            // Then check if the modal/popup cookie consent is present
            const cookiePopupSelectors = [
                // These target the white popup box in your screenshots
                '.ReactModal__Content',
                '[aria-modal="true"]',
                '.modal-content',
                '.cookie-modal',
                '.consent-modal',
                'div[role="dialog"]'
            ];

            for (const popupSelector of cookiePopupSelectors) {
                const hasPopup = await page.evaluate((sel) => {
                    return !!document.querySelector(sel);
                }, popupSelector);

                if (hasPopup) {
                    console.log(`Found cookie popup with selector: ${popupSelector}`);

                    // Take a screenshot of the popup before closing
                    await saveScreenshot(page, '02a-cookie-popup');

                    // Try to find buttons in the popup
                    const popupButtonSelectors = [
                        'button:contains("Accept Cookies and Continue")',
                        'button:contains("Confirm")',
                        'button:contains("Accept")',
                        'button:contains("Continue")',
                        'button.cGJDXG',
                        'button.btn-primary',
                        // Specifically targeting the "Confirm My Choices" button
                        'button:contains("Confirm My Choices")',
                        // Fallback to any buttons in the popup
                        `${popupSelector} button`
                    ];

                    for (const buttonSelector of popupButtonSelectors) {
                        const buttonText = buttonSelector.includes(':contains') ?
                            buttonSelector.match(/:contains\("(.+?)"\)/)[1] :
                            'Button';

                        const clickedButton = await page.evaluate((sel, btnText, popupSel) => {
                            // For contains selectors
                            if (sel.includes(':contains(')) {
                                const text = btnText;
                                const popup = document.querySelector(popupSel);
                                const buttons = popup ?
                                    Array.from(popup.querySelectorAll('button')) :
                                    Array.from(document.querySelectorAll('button'));

                                const button = buttons.find(b => b.textContent.includes(text));
                                if (button) {
                                    button.click();
                                    return true;
                                }
                            } else {
                                // Regular selector
                                const button = document.querySelector(sel);
                                if (button) {
                                    button.click();
                                    return true;
                                }
                            }
                            return false;
                        }, buttonSelector, buttonText, popupSelector);

                        if (clickedButton) {
                            console.log(`Clicked "${buttonText}" in popup`);
                            await safeWait(1000);
                            await saveScreenshot(page, '02b-popup-closed');
                            break;
                        }
                    }

                    // If we found a popup, no need to keep searching
                    break;
                }
            }

            // If the above methods didn't work, try the standard cookie buttons
            const cookieSelectors = [
                'button[id*="cookie"]',
                'button[class*="cookie"]',
                'button[id*="accept"]',
                'button[class*="accept"]',
                'button[id*="consent"]',
                'button[class*="consent"]',
                '[aria-label="Accept cookies"]',
                '[data-testid="close-button"]',
                // Extra selectors from screenshots
                'button.cmc-cookie-policy-banner__close',
                '.cmc-cookie-policy-banner__close',
                'button[class*="cookieBanner"]',
                'button.cookieBanner'
            ];

            for (const selector of cookieSelectors) {
                const hasCookieButton = await page.evaluate((sel) => {
                    // First try querySelector
                    let element = document.querySelector(sel);

                    // If not found and it's a :contains selector, try a different approach
                    if (!element && sel.includes(':contains("')) {
                        const textToFind = sel.match(/:contains\("(.+?)"\)/)[1];
                        const buttons = document.querySelectorAll('button');
                        for (const button of buttons) {
                            if (button.textContent.includes(textToFind)) {
                                element = button;
                                break;
                            }
                        }
                    }

                    return !!element;
                }, selector);

                if (hasCookieButton) {
                    console.log(`Found cookie consent button with selector: ${selector}`);
                    await page.evaluate((sel) => {
                        // First try querySelector
                        let element = document.querySelector(sel);

                        // If not found and it's a :contains selector, try a different approach
                        if (!element && sel.includes(':contains("')) {
                            const textToFind = sel.match(/:contains\("(.+?)"\)/)[1];
                            const buttons = document.querySelectorAll('button');
                            for (const button of buttons) {
                                if (button.textContent.includes(textToFind)) {
                                    element = button;
                                    break;
                                }
                            }
                        }

                        if (element) element.click();
                    }, selector);

                    console.log('Clicked cookie consent button');
                    // Replace page.waitForTimeout with safeWait
                    await safeWait(1000);
                    await saveScreenshot(page, '02-cookies-accepted');
                    break;
                }
            }
        } catch (e) {
            console.log('Error handling cookie consent:', e.message);
        }

        // Simulate scrolling up and down a bit
        console.log('Scrolling up and down...');
        await page.evaluate(() => {
            // Initial scroll down
            window.scrollBy(0, 300);
            return new Promise(resolve => {
                setTimeout(() => {
                    // Scroll up
                    window.scrollBy(0, -150);
                    setTimeout(() => {
                        // Scroll down again
                        window.scrollBy(0, 200);
                        resolve();
                    }, 500 + Math.random() * 500);
                }, 500 + Math.random() * 500);
            });
        });

        await saveScreenshot(page, '03-initial-scrolling');

        // Try to find and click on the "Add to Watchlist" button
        console.log('Looking for Add to Watchlist button...');
        try {
            const watchlistSelectors = [
                'button[aria-label="Add to Watchlist"]',
                'button[data-watchlist-add]',
                'button.watchlistStar',
                '[data-testid="watchlist-button"]',
                'button.watchlist-button',
                'span[class*="WatchlistButton"]',
                '[class*="WatchlistButton"]',
                'button[class*="watchlist"]',
                'button[class*="Watchlist"]',
                // Looking for the star icon as seen in the screenshot
                'svg[class*="star"]',
                '.star-icon',
                '.watchlist-star',
                // The circled star in the screenshot
                '.sc-8680cc5a-0',
                '.sc-8680cc5a-1',
                '.sc-8680cc5a-2',
                '[href="#"]', // Looking for the star element
                '.dbgwqb'
            ];

            let watchlistClicked = false;

            for (const selector of watchlistSelectors) {
                if (watchlistClicked) break;

                const hasWatchlistButton = await page.evaluate((sel) => {
                    // Standard querySelector - remove the :contains part
                    let element = document.querySelector(sel);

                    if (element) {
                        // Check if it's visible
                        const rect = element.getBoundingClientRect();
                        const isVisible = rect.top >= 0 && rect.left >= 0 &&
                            rect.bottom <= window.innerHeight &&
                            rect.right <= window.innerWidth;
                        return isVisible;
                    }
                    return false;
                }, selector);

                if (hasWatchlistButton) {
                    console.log(`Found watchlist button with selector: ${selector}`);

                    // Try clicking it
                    await page.evaluate((sel) => {
                        let element = document.querySelector(sel);

                        if (element) {
                            console.log('Clicking watchlist button');
                            element.click();
                        }
                    }, selector);

                    console.log('Clicked Add to Watchlist button');
                    watchlistClicked = true;
                    // Replace page.waitForTimeout with safeWait
                    await safeWait(2000);
                    await saveScreenshot(page, '04-watchlist-clicked');

                    // Check if a login popup appeared
                    const hasLoginPopup = await page.evaluate(() => {
                        // Look for login form or prompt
                        const loginElements = document.querySelectorAll('input[type="email"], input[type="password"], form[action*="login"]');
                        return loginElements.length > 0;
                    });

                    if (hasLoginPopup) {
                        console.log('Login popup detected - closing it');

                        // Try to find and click close button
                        const closeSelectors = [
                            'button[aria-label="Close"]',
                            'button.close',
                            'button[class*="close"]',
                            'svg[class*="close"]',
                            'button:contains("Close")',
                            'button:contains("Cancel")',
                            '[data-testid="close-button"]'
                        ];

                        for (const closeSelector of closeSelectors) {
                            const hasCloseButton = await page.evaluate((sel) => {
                                let element = document.querySelector(sel);
                                return !!element;
                            }, closeSelector);

                            if (hasCloseButton) {
                                await page.evaluate((sel) => {
                                    let element = document.querySelector(sel);
                                    if (element) element.click();
                                }, closeSelector);

                                console.log('Closed login popup');
                                // Replace page.waitForTimeout with safeWait
                                await safeWait(1000);
                                await saveScreenshot(page, '05-login-popup-closed');
                                break;
                            }
                        }
                    }
                    break;
                }
            }

            if (!watchlistClicked) {
                console.log('Watchlist button not found or not clickable');
            }
        } catch (e) {
            console.log('Error while trying to add to watchlist:', e.message);
        }

        // First, scroll down gradually like a human would
        console.log('Scrolling page naturally...');
        await page.evaluate(() => {
            return new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    // Occasionally pause scrolling to simulate reading
                    if (totalHeight % 500 === 0) {
                        clearInterval(timer);
                        setTimeout(() => {
                            const newTimer = setInterval(() => {
                                window.scrollBy(0, distance);
                                totalHeight += distance;

                                if (totalHeight >= document.body.scrollHeight * 0.8) {
                                    clearInterval(newTimer);
                                    resolve();
                                }
                            }, 100 + Math.random() * 200); // Vary scroll speed
                        }, 1000 + Math.random() * 2000); // Random pause
                    }

                    if (totalHeight >= document.body.scrollHeight * 0.8) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100 + Math.random() * 200); // Random scroll speed
            });
        });

        await saveScreenshot(page, '06-scrolled-page');

        // Try to find and click on some tabs like Overview, Markets, etc.
        console.log('Interacting with page elements...');
        try {
            // Try to find elements that look like tabs or navigation items
            const tabSelectors = [
                '.nav-link',
                '.tab',
                'a[href*="markets"]',
                'a[href*="historical"]',
                '.tabContainer a',
                '.nav-item',
                '[role="tab"]',
                'button.tab',
                '.tabs button'
            ];

            // Try each selector until we find something to click
            let tabInteractionSuccessful = false;

            for (const selector of tabSelectors) {
                if (tabInteractionSuccessful) break;

                const hasElements = await page.evaluate((sel) => {
                    const elements = document.querySelectorAll(sel);
                    return elements.length > 0;
                }, selector);

                if (hasElements) {
                    console.log(`Found clickable elements with selector: ${selector}`);

                    // Click on a random element matching this selector - but be safer not to navigate away
                    const didClick = await page.evaluate((sel) => {
                        const elements = Array.from(document.querySelectorAll(sel));
                        if (elements.length > 0) {
                            // Choose a tab that doesn't seem like it would navigate away
                            const safeElements = elements.filter(el => {
                                const href = el.getAttribute('href');
                                return !href || href === '#' || href.startsWith('#') || href.includes(window.location.pathname);
                            });

                            if (safeElements.length > 0) {
                                const randomElement = safeElements[Math.floor(Math.random() * safeElements.length)];
                                console.log(`Clicking on ${randomElement.textContent || randomElement.innerText || 'element'}`);
                                randomElement.click();
                                return true;
                            }
                            return false;
                        }
                        return false;
                    }, selector);

                    if (didClick) {
                        // Use safeWait instead of setTimeout directly
                        await safeWait(2000 + Math.random() * 3000);
                        console.log('Waited after clicking tab');
                        await saveScreenshot(page, '07-tab-clicked');
                        tabInteractionSuccessful = true;
                        break;
                    }
                }
            }
        } catch (e) {
            console.log('Could not interact with tabs:', e.message);
        }

        // Scroll to a different position
        await page.evaluate(() => {
            window.scrollTo(0, Math.random() * document.body.scrollHeight * 0.5);
        });

        // Wait a random amount of time (5-15 seconds) to simulate reading
        const readTime = 5000 + Math.floor(Math.random() * 10000);
        console.log(`Waiting ${readTime}ms to simulate reading the page...`);
        await safeWait(readTime);
        const screenshotPath = `visit-${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: false });
        console.log(`Screenshot saved to ${screenshotPath}`);

        // Move mouse randomly across the page
        const viewportSize = await page.evaluate(() => {
            return {
                width: window.innerWidth,
                height: window.innerHeight
            };
        });

        // Simulate mouse movements
        console.log('Moving mouse randomly across page...');
        for (let i = 0; i < 5; i++) {
            const x = Math.floor(Math.random() * viewportSize.width);
            const y = Math.floor(Math.random() * viewportSize.height);
            await page.mouse.move(x, y);
            await safeWait(300 + Math.random() * 500);
        }

        // Final screenshot
        await saveScreenshot(page, '09-final-state');

        // Log success
        console.log('\n✅ VISIT SUCCESSFUL');
        logResult({
            success: true,
            title,
            loadTime,
            proxy: `${proxy.host}:${proxy.port}`,
            screenshots: screenshotsDir,
            visitId: visitId
        });

        return true;
    } catch (error) {
        console.error(`\n❌ ERROR: ${error.message}`);

        // Try to save error screenshot if possible
        try {
            if (page) {
                const errorScreenshotPath = `${screenshotsDir}/error.png`;
                await page.screenshot({ path: errorScreenshotPath, fullPage: false });
                console.log(`Error screenshot saved to ${errorScreenshotPath}`);
            }
        } catch (screenshotError) {
            console.log('Could not save error screenshot:', screenshotError.message);
        }

        logResult({
            success: false,
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
            console.log('Browser closed');
        }
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

        // Try up to 3 times with different proxies if needed
        let success = false;
        let attempts = 0;
        const maxAttempts = 3;

        while (!success && attempts < maxAttempts) {
            attempts++;
            if (attempts > 1) {
                console.log(`Attempt ${attempts}/${maxAttempts} with a different proxy...`);
            }

            success = await visitPage();

            if (success) {
                successCount++;
                break;
            } else if (attempts < maxAttempts) {
                // Wait a moment before trying with a different proxy
                console.log('Waiting 3 seconds before trying another proxy...');
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
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