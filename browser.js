// browser.js
const puppeteer = require('puppeteer');

class BrowserVisitor {
    constructor() {
        this.browser = null;
        this.initialized = false;
    }

    async initialize() {
        if (!this.initialized) {
            this.browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu'
                ]
            });
            this.initialized = true;
            console.log('Browser initialized');
        }
    }

    async visitPage(url, options = {}) {
        const {
            userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            proxyServer = null,
            timeout = 30000,
            scrollPage = true,
            interactWithPage = true
        } = options;

        if (!this.initialized) {
            await this.initialize();
        }

        const page = await this.browser.newPage();

        try {
            // Set user agent
            await page.setUserAgent(userAgent);

            // Set viewport
            await page.setViewport({
                width: 1366,
                height: 768
            });

            // Set proxy if provided
            if (proxyServer) {
                // Note: This requires launching the browser with the --proxy-server flag
                // For simplicity, we're not implementing full proxy support here
                console.log(`Would use proxy: ${proxyServer}`);
            }

            // Set request timeout
            page.setDefaultNavigationTimeout(timeout);

            // Set referer
            await page.setExtraHTTPHeaders({
                'Referer': 'https://www.google.com/search?q=cryptocurrency+prices'
            });

            // Navigate to the URL
            console.log(`Browser navigating to ${url}`);
            await page.goto(url, {
                waitUntil: 'networkidle2'
            });

            // Simulate real user behavior
            if (scrollPage) {
                console.log('Simulating scrolling...');

                // Scroll down the page gradually
                await page.evaluate(() => {
                    return new Promise((resolve) => {
                        let totalHeight = 0;
                        const distance = 100;
                        const timer = setInterval(() => {
                            const scrollHeight = document.body.scrollHeight;
                            window.scrollBy(0, distance);
                            totalHeight += distance;

                            if (totalHeight >= scrollHeight) {
                                clearInterval(timer);
                                resolve();
                            }
                        }, 200);
                    });
                });
            }

            // Optional: interact with page elements
            if (interactWithPage) {
                console.log('Simulating user interactions...');

                // Click on random links (avoiding external links)
                const internalLinks = await page.evaluate(() => {
                    const links = Array.from(document.querySelectorAll('a')).filter(link => {
                        const href = link.href;
                        return href && href.includes(window.location.hostname) && !href.includes('twitter') && !href.includes('facebook');
                    });

                    return links.map(link => link.href);
                });

                if (internalLinks.length > 0) {
                    // Click a random internal link
                    const randomLink = internalLinks[Math.floor(Math.random() * internalLinks.length)];
                    console.log(`Clicking on random link: ${randomLink}`);
                    await page.goto(randomLink, { waitUntil: 'networkidle2' });

                    // Wait for a random period (1-5 seconds)
                    await new Promise(r => setTimeout(r, 1000 + Math.random() * 4000));

                    // Go back to the original page
                    await page.goBack({ waitUntil: 'networkidle2' });
                }
            }

            // Wait for a random period (2-10 seconds) to simulate reading
            const readingTime = 2000 + Math.floor(Math.random() * 8000);
            console.log(`Waiting ${readingTime}ms to simulate reading`);
            await new Promise(r => setTimeout(r, readingTime));

            // Extract key information to verify we're on the right page
            const tokenId = url.split('/currencies/')[1]?.split('/')[0] || '';
            const pageInfo = await page.evaluate((tokenId) => {
                // Check for common block indicators
                const bodyText = document.body.innerText.toLowerCase();
                const isBlocked = bodyText.includes('captcha') ||
                    bodyText.includes('blocked') ||
                    bodyText.includes('rate limit') ||
                    bodyText.includes('too many requests');

                // Try to get the token name, price, and other details
                let tokenName = '';
                let tokenPrice = '';
                let marketCap = '';
                let tokenRank = '';

                // More comprehensive search for token name
                try {
                    // Try different known selectors for token name
                    const possibleNameSelectors = [
                        'h2.nameHeader',
                        'h1.sc-1d5146e6-0',
                        '.nameSection h2',
                        '.coin-name-pc',
                        '.namePill',
                        '.sc-f8982b1f-0'
                    ];

                    for (const selector of possibleNameSelectors) {
                        const el = document.querySelector(selector);
                        if (el && el.textContent && el.textContent.trim()) {
                            tokenName = el.textContent.trim();
                            break;
                        }
                    }

                    // If still not found, try a more general approach
                    if (!tokenName) {
                        // Look for elements containing the token identifier in their text
                        const allHeaders = Array.from(document.querySelectorAll('h1, h2'));
                        for (const header of allHeaders) {
                            if (header.textContent && header.textContent.toLowerCase().includes(tokenId.toLowerCase())) {
                                tokenName = header.textContent.trim();
                                break;
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error extracting token name:', e);
                }

                // More comprehensive search for price
                try {
                    const possiblePriceSelectors = [
                        '.priceValue',
                        '.sc-d855742d-0',
                        '.price-value',
                        '.coinCurrentPrice',
                        '.sc-f8982b1f-1'
                    ];

                    for (const selector of possiblePriceSelectors) {
                        const el = document.querySelector(selector);
                        if (el && el.textContent && el.textContent.trim()) {
                            tokenPrice = el.textContent.trim();
                            break;
                        }
                    }

                    // If still not found, look for elements with $ or € symbol
                    if (!tokenPrice) {
                        const allElements = document.querySelectorAll('*');
                        for (const el of allElements) {
                            if (el.textContent && (el.textContent.includes('$') || el.textContent.includes('€'))) {
                                const text = el.textContent.trim();
                                // Check if it looks like a price (has numbers and currency symbol)
                                if (/[\$€][\d,.]+/.test(text) || /[\d,.]+[\$€]/.test(text)) {
                                    tokenPrice = text;
                                    break;
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error extracting price:', e);
                }

                // Look for market cap
                try {
                    const possibleMarketCapSelectors = [
                        '[data-role="market-cap"]',
                        '.marketCap',
                        '.statsValue'
                    ];

                    for (const selector of possibleMarketCapSelectors) {
                        const elements = document.querySelectorAll(selector);
                        for (const el of elements) {
                            if (el.textContent && el.textContent.toLowerCase().includes('market cap')) {
                                marketCap = el.textContent.trim();
                                break;
                            }
                        }
                        if (marketCap) break;
                    }
                } catch (e) {
                    console.error('Error extracting market cap:', e);
                }

                // Look for rank
                try {
                    const possibleRankSelectors = [
                        '[data-role="rank"]',
                        '.rank',
                        '.rankingItem'
                    ];

                    for (const selector of possibleRankSelectors) {
                        const elements = document.querySelectorAll(selector);
                        for (const el of elements) {
                            if (el.textContent && el.textContent.toLowerCase().includes('rank')) {
                                tokenRank = el.textContent.trim();
                                break;
                            }
                        }
                        if (tokenRank) break;
                    }
                } catch (e) {
                    console.error('Error extracting rank:', e);
                }

                // Check if the page content seems to match what we expect for a token page
                const isTokenPage = (
                    document.URL.includes(tokenId) &&
                    (tokenName || tokenPrice) &&
                    !isBlocked
                );

                return {
                    isBlocked,
                    tokenName,
                    tokenPrice,
                    marketCap,
                    tokenRank,
                    isTokenPage
                };
            }, tokenId);

            if (pageInfo.isBlocked) {
                console.warn('⚠️ Page appears to be showing a block/captcha page');
            }

            if (pageInfo.isTokenPage) {
                console.log('✅ Confirmed this is the correct token page');
                console.log(`Token Name: ${pageInfo.tokenName || 'Not found'}`);
                console.log(`Current Price: ${pageInfo.tokenPrice || 'Not found'}`);
                console.log(`Market Cap: ${pageInfo.marketCap || 'Not found'}`);
                console.log(`Rank: ${pageInfo.tokenRank || 'Not found'}`);
            } else {
                console.warn('⚠️ This may not be the correct token page');
            }

            // Save a screenshot for verification (uncomment to enable)
            // const screenshotPath = `visit-${Date.now()}.png`;
            // await page.screenshot({ path: screenshotPath, fullPage: true });
            // console.log(`Screenshot saved to ${screenshotPath}`);

            return {
                success: true,
                isBlocked: pageInfo.isBlocked,
                isTokenPage: pageInfo.isTokenPage,
                tokenInfo: {
                    name: pageInfo.tokenName,
                    price: pageInfo.tokenPrice,
                    marketCap: pageInfo.marketCap,
                    rank: pageInfo.tokenRank
                },
                title: await page.title(),
                url: page.url()
            };
        } catch (error) {
            console.error(`Browser visit error: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        } finally {
            await page.close();
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.initialized = false;
            console.log('Browser closed');
        }
    }
}

module.exports = BrowserVisitor;