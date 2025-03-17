// multi-session-visit.js
require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const PROXIES = require('./proxies');

// Get the token identifier from .env file
const tokenIdentifier = process.env.TOKEN_IDENTIFIER || 'distribute';
const visitDelay = parseInt(process.env.VISIT_DELAY) || 10000; // 10 seconds between visits
const concurrentSessions = parseInt(process.env.CONCURRENT_SESSIONS) || 4; // Default to 4 concurrent sessions

// Create directories if they don't exist
const logsDir = './logs';
const screenshotsBaseDir = './screenshots';

if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

if (!fs.existsSync(screenshotsBaseDir)) {
    fs.mkdirSync(screenshotsBaseDir, { recursive: true });
}

// Function to log results
function logResult(result) {
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

// Function to get a random proxy
function getRandomProxy() {
    return PROXIES[Math.floor(Math.random() * PROXIES.length)];
}

// Function to check for privacy popups and handle them
async function checkAndHandleDoNotSellPopup(page, saveScreenshot, safeWait) {
    console.log('Checking for privacy popups...');
    try {
        // Look for the specific popups with these titles
        const hasPrivacyPopup = await page.evaluate(() => {
            const popupTitleElements = Array.from(document.querySelectorAll('div, h2, h3, p'));
            return popupTitleElements.some(el =>
                    el.textContent && (
                        el.textContent.includes('Do Not Sell or Share My Personal Data') ||
                        el.textContent.includes('About Your Privacy')
                    )
            );
        });

        if (hasPrivacyPopup) {
            console.log('Found privacy popup');
            await saveScreenshot(page, 'privacy-popup');

            // Try to find the "Reject All" button
            const clickedRejectButton = await page.evaluate(() => {
                // Look for buttons with specific text
                const rejectButtons = Array.from(document.querySelectorAll('button')).filter(button =>
                        button.textContent && (
                            button.textContent.includes('Reject All') ||
                            button.textContent.trim() === 'Reject All'
                        )
                );

                if (rejectButtons.length > 0) {
                    rejectButtons[0].click();
                    return true;
                }
                return false;
            });

            if (clickedRejectButton) {
                console.log('Clicked "Reject All" button');
                await safeWait(1500);
                await saveScreenshot(page, 'reject-all-clicked');
                return true;
            } else {
                console.log('Could not find "Reject All" button, trying alternative selectors');

                // Try clicking using specific selectors based on your screenshots
                const alternativeSelectors = [
                    'button.cGJDXG',
                    'button[class*="reject"]',
                    'button.gdpr-reject-all',
                    'button[data-testid="button-decline"]',
                    '.ReactModal__Content button:first-child', // First button in modal (typically reject)
                    'div[role="dialog"] button:first-child'
                ];

                for (const selector of alternativeSelectors) {
                    try {
                        const buttonExists = await page.$(selector);
                        if (buttonExists) {
                            await page.click(selector);
                            console.log(`Clicked alternate button using selector: ${selector}`);
                            await safeWait(1500);
                            await saveScreenshot(page, 'alternative-reject-clicked');
                            return true;
                        }
                    } catch (err) {
                        console.log(`Error clicking ${selector}: ${err.message}`);
                    }
                }
            }
        }
    } catch (e) {
        console.log('Error handling privacy popup:', e.message);
    }
    return false;
}

// Simple function to visit a page with Puppeteer
async function visitPage(sessionId) {
    const proxy = getRandomProxy();

    // Create a unique directory for this visit's screenshots
    const timestamp = Date.now();
    const visitId = `visit-s${sessionId}-${timestamp}`;
    const screenshotsDir = path.join(screenshotsBaseDir, visitId);
    fs.mkdirSync(screenshotsDir, { recursive: true });

    console.log(`\n=== TOKEN VISIBILITY VISIT (Session ${sessionId}) ===`);
    console.log(`Visit ID: ${visitId}`);
    console.log(`Token: ${tokenIdentifier}`);
    console.log(`URL: https://coinmarketcap.com/currencies/${tokenIdentifier}/`);
    console.log(`Time: ${new Date().toISOString()}`);
    console.log(`Using proxy: ${proxy.host}:${proxy.port}`);
    console.log(`Screenshots will be saved to: ${screenshotsDir}`);

    // Function to save screenshot with step name
    const saveScreenshot = async (page, stepName) => {
        const screenshotPath = path.join(screenshotsDir, `${stepName}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });
        console.log(`[Session ${sessionId}] Screenshot saved: ${screenshotPath}`);
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
        console.log(`[Session ${sessionId}] Launching browser...`);
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
        console.log(`[Session ${sessionId}] Using user agent: ${userAgent.substring(0, 30)}...`);

        // Set referer to make it look like we're coming from Google
        await page.setExtraHTTPHeaders({
            'Referer': 'https://www.google.com/search?q=cryptocurrency+token+distribute'
        });

        // Navigate to the page
        console.log(`[Session ${sessionId}] Visiting page...`);
        const startTime = Date.now();
        await page.goto(`https://coinmarketcap.com/currencies/${tokenIdentifier}/`, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        const loadTime = Date.now() - startTime;
        console.log(`[Session ${sessionId}] Page loaded in ${loadTime}ms`);

        // Get the page title
        const title = await page.title();
        console.log(`[Session ${sessionId}] Page title: ${title}`);

        // Take initial screenshot
        await saveScreenshot(page, '01-initial-load');

        // Accept cookies if the banner is present
        console.log(`[Session ${sessionId}] Checking for cookie consent banner...`);
        try {
            // First check if the bottom cookie banner exists
            const bottomBannerSelector = '.cLyNAm, .cmc-cookie-policy-banner';
            const hasBottomBanner = await page.evaluate((sel) => {
                return !!document.querySelector(sel);
            }, bottomBannerSelector);

            if (hasBottomBanner) {
                console.log(`[Session ${sessionId}] Found bottom cookie banner`);
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
                        console.log(`[Session ${sessionId}] Clicked "${buttonText}" on bottom banner`);
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
                    console.log(`[Session ${sessionId}] Found cookie popup with selector: ${popupSelector}`);

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
                            console.log(`[Session ${sessionId}] Clicked "${buttonText}" in popup`);
                            await safeWait(1000);
                            await saveScreenshot(page, '02b-popup-closed');
                            break;
                        }
                    }
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
                    console.log(`[Session ${sessionId}] Found cookie consent button with selector: ${selector}`);
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

                    console.log(`[Session ${sessionId}] Clicked cookie consent button`);
                    await safeWait(1000);
                    await saveScreenshot(page, '02-cookies-accepted');
                    break;
                }
            }
        } catch (e) {
            console.log(`[Session ${sessionId}] Error handling cookie consent:`, e.message);
        }

        // Check for "Do Not Sell or Share My Personal Data" popup
        await checkAndHandleDoNotSellPopup(page, saveScreenshot, safeWait);

        // Try to find and click on the "Add to Watchlist" button immediately after handling popups
        console.log(`[Session ${sessionId}] Looking for Add to Watchlist button immediately after popup handling...`);
        try {
            const watchlistSelectors = [
                // Add most specific selectors first based on the HTML structure
                'button.WatchlistStar_watchlist-button__OX4ZZ',
                'div.BasePopover_base__T5yOf button',
                'button[class*="WatchlistStar_watchlist-button"]',
                'button.BaseButton_base__34gwo',
                // Original selectors
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
                    console.log(`[Session ${sessionId}] Found watchlist button with selector: ${selector}`);

                    // Before clicking, take a screenshot of the pre-click state
                    await saveScreenshot(page, '03-pre-watchlist-click');

                    // Try clicking it
                    await page.evaluate((sel) => {
                        let element = document.querySelector(sel);

                        if (element) {
                            console.log('Clicking watchlist button');
                            element.click();
                        }
                    }, selector);

                    console.log(`[Session ${sessionId}] Clicked Add to Watchlist button`);
                    watchlistClicked = true;
                    await safeWait(2000);
                    await saveScreenshot(page, '04-watchlist-clicked');

                    // Try to verify if the watchlist action was successful
                    const watchlistVerification = await page.evaluate(() => {
                        // Look for visual confirmation like a filled star, confirmation tooltip, etc.
                        const indicators = [
                            // Look for filled star, success message, or other indicators
                            document.querySelector('button[aria-label="Remove from Watchlist"]'),
                            document.querySelector('svg[class*="star"][fill="#FFD700"]'), // Check for gold filled star
                            document.querySelector('div[class*="tooltip"][class*="success"]'),
                            // Check for class changes on the watchlist button
                            document.querySelector('button[class*="watchlist"][class*="active"]'),
                            document.querySelector('span[class*="watchlist"][class*="active"]')
                        ];

                        // Also check for color changes in the star icon
                        const starElements = document.querySelectorAll('svg[class*="star"], .star-icon');
                        let colorChanged = false;
                        if (starElements.length > 0) {
                            // Check if the star changed color to filled or active state
                            colorChanged = Array.from(starElements).some(el => {
                                const styles = window.getComputedStyle(el);
                                const fill = styles.fill || styles.color;
                                // Check for common "active" colors like gold, yellow, or non-black
                                return fill && (
                                    fill.includes('rgb(255, 215, 0)') || // Gold
                                    fill.includes('rgb(255, 255, 0)') || // Yellow
                                    fill !== 'rgb(0, 0, 0)' // Not black
                                );
                            });
                        }

                        return {
                            success: indicators.some(el => el !== null) || colorChanged,
                            // Return any text indication we might find
                            message: document.querySelector('[class*="toast"]')?.textContent ||
                                document.querySelector('[role="alert"]')?.textContent || '',
                            colorChanged: colorChanged
                        };
                    });

                    if (watchlistVerification.success) {
                        console.log(`[Session ${sessionId}] ✅ Watchlist action appears successful!`);
                        if (watchlistVerification.colorChanged) {
                            console.log(`[Session ${sessionId}] Star icon color has changed, indicating successful addition to watchlist`);
                        }
                        if (watchlistVerification.message) {
                            console.log(`[Session ${sessionId}] Confirmation message: ${watchlistVerification.message}`);
                        }
                        await saveScreenshot(page, '05-watchlist-verification-success');
                    } else {
                        console.log(`[Session ${sessionId}] ⚠️ Could not verify watchlist action success`);
                        await saveScreenshot(page, '05-watchlist-verification-unknown');
                    }

                    // Check if a login popup appeared
                    const hasLoginPopup = await page.evaluate(() => {
                        // Look for login form or prompt
                        const loginElements = document.querySelectorAll('input[type="email"], input[type="password"], form[action*="login"]');
                        return loginElements.length > 0;
                    });

                    if (hasLoginPopup) {
                        console.log(`[Session ${sessionId}] Login popup detected - closing it`);

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

                                console.log(`[Session ${sessionId}] Closed login popup`);
                                await safeWait(1000);
                                await saveScreenshot(page, '06-login-popup-closed');
                                break;
                            }
                        }
                    }
                    break;
                }
            }

            if (!watchlistClicked) {
                console.log(`[Session ${sessionId}] Watchlist button not found or not clickable`);
            }
        } catch (e) {
            console.log(`[Session ${sessionId}] Error while trying to add to watchlist:`, e.message);
        }

        // Now do the scrolling after watchlist attempt
        console.log(`[Session ${sessionId}] Scrolling up and down...`);
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

        await saveScreenshot(page, '07-initial-scrolling');

        // Check again for privacy popup (it might appear after scrolling)
        await checkAndHandleDoNotSellPopup(page, saveScreenshot, safeWait);

        // First, scroll down gradually like a human would
        console.log(`[Session ${sessionId}] Scrolling page naturally...`);
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

        await saveScreenshot(page, '08-scrolled-page');

        // Check again for privacy popup
        await checkAndHandleDoNotSellPopup(page, saveScreenshot, safeWait);

        // Try to find and click on some tabs like Overview, Markets, etc.
        console.log(`[Session ${sessionId}] Interacting with page elements...`);
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
                    console.log(`[Session ${sessionId}] Found clickable elements with selector: ${selector}`);

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
                        console.log(`[Session ${sessionId}] Waited after clicking tab`);
                        await saveScreenshot(page, '09-tab-clicked');
                        tabInteractionSuccessful = true;
                        break;
                    }
                }
            }
        } catch (e) {
            console.log(`[Session ${sessionId}] Could not interact with tabs:`, e.message);
        }

        // Check again for privacy popup
        await checkAndHandleDoNotSellPopup(page, saveScreenshot, safeWait);

        // Scroll to a different position
        await page.evaluate(() => {
            window.scrollTo(0, Math.random() * document.body.scrollHeight * 0.5);
        });

        // Wait a random amount of time (5-15 seconds) to simulate reading
        const readTime = 5000 + Math.floor(Math.random() * 10000);
        console.log(`[Session ${sessionId}] Waiting ${readTime}ms to simulate reading the page...`);
        await safeWait(readTime);
        await saveScreenshot(page, '10-reading-page');

        // Check again for privacy popup
        await checkAndHandleDoNotSellPopup(page, saveScreenshot, safeWait);

        // Move mouse randomly across the page
        const viewportSize = await page.evaluate(() => {
            return {
                width: window.innerWidth,
                height: window.innerHeight
            };
        });

        // Simulate mouse movements
        console.log(`[Session ${sessionId}] Moving mouse randomly across page...`);
        for (let i = 0; i < 5; i++) {
            const x = Math.floor(Math.random() * viewportSize.width);
            const y = Math.floor(Math.random() * viewportSize.height);
            await page.mouse.move(x, y);
            await safeWait(300 + Math.random() * 500);
        }

        // Final screenshot
        await saveScreenshot(page, '11-final-state');

        // Log success
        console.log(`\n[Session ${sessionId}] ✅ VISIT SUCCESSFUL`);
        logResult({
            sessionId,
            success: true,
            title,
            loadTime,
            proxy: `${proxy.host}:${proxy.port}`,
            screenshots: screenshotsDir,
            visitId: visitId
        });

        return true;
    } catch (error) {
        console.error(`\n[Session ${sessionId}] ❌ ERROR: ${error.message}`);

        // Try to save error screenshot if possible
        try {
            if (page) {
                const errorScreenshotPath = path.join(screenshotsDir, 'error.png');
                await page.screenshot({ path: errorScreenshotPath, fullPage: false });
                console.log(`[Session ${sessionId}] Error screenshot saved to ${errorScreenshotPath}`);
            }
        } catch (screenshotError) {
            console.log(`[Session ${sessionId}] Could not save error screenshot:`, screenshotError.message);
        }

        logResult({
            sessionId,
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
            console.log(`[Session ${sessionId}] Browser closed`);
        }
    }
}

// Function to run a batch of concurrent visits
async function runConcurrentVisits(batchSize) {
    console.log(`\n=== Starting batch of ${batchSize} concurrent visits ===`);

    // Create array of visit promises
    const visitPromises = [];
    for (let i = 0; i < batchSize; i++) {
        visitPromises.push(visitPage(i + 1)); // Session IDs start at 1
    }

    // Wait for all visits to complete
    const results = await Promise.all(visitPromises);

    // Count successes
    const successCount = results.filter(result => result).length;

    console.log(`\n=== Batch completed ===`);
    console.log(`Total visits: ${batchSize}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${batchSize - successCount}`);
    console.log(`Success rate: ${(successCount/batchSize*100).toFixed(2)}%`);

    return successCount;
}

// Main function to run visits
async function main() {
    const startTime = Date.now();
    const totalVisits = parseInt(process.env.TOTAL_VISITS) || 10; // Default to 10 visits total
    let completedVisits = 0;
    let successfulVisits = 0;

    console.log(`\n=== TOKEN VISIBILITY CAMPAIGN ===`);
    console.log(`Token: ${tokenIdentifier}`);
    console.log(`Total planned visits: ${totalVisits}`);
    console.log(`Concurrent sessions: ${concurrentSessions}`);

    // Calculate how many batches we need
    const batches = Math.ceil(totalVisits / concurrentSessions);

    for (let i = 0; i < batches; i++) {
        // For the last batch, we might need fewer than concurrentSessions
        const remainingVisits = totalVisits - completedVisits;
        const batchSize = Math.min(concurrentSessions, remainingVisits);

        console.log(`\nRunning batch ${i+1} of ${batches} (${batchSize} sessions)`);
        const batchSuccesses = await runConcurrentVisits(batchSize);

        completedVisits += batchSize;
        successfulVisits += batchSuccesses;

        // If this is not the final batch, add a delay between batches
        if (i < batches - 1) {
            const batchDelay = visitDelay + Math.floor(Math.random() * 5000); // Add some randomness
            console.log(`Waiting ${batchDelay/1000} seconds before next batch...`);
            await new Promise(r => setTimeout(r, batchDelay));
        }
    }

    // Calculate statistics
    const endTime = Date.now();
    const totalTimeMin = ((endTime - startTime) / 60000).toFixed(2);

    console.log(`\n=== CAMPAIGN COMPLETED ===`);
    console.log(`Total visits: ${completedVisits}`);
    console.log(`Successful: ${successfulVisits}`);
    console.log(`Failed: ${completedVisits - successfulVisits}`);
    console.log(`Success rate: ${(successfulVisits/completedVisits*100).toFixed(2)}%`);
    console.log(`Total runtime: ${totalTimeMin} minutes`);
}

// Run the main function
main().catch(error => {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
});