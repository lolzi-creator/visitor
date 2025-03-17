// config.js
require('dotenv').config();

// Helper function to parse boolean values from env
const parseBool = (val) => {
    if (typeof val === 'boolean') return val;
    if (typeof val !== 'string') return false;
    return val.toLowerCase() === 'true' || val === '1';
};

module.exports = {
    // Token details
    tokenIdentifier: process.env.TOKEN_IDENTIFIER,

    // Request configuration
    requestInterval: parseInt(process.env.REQUEST_INTERVAL) || 30000,
    concurrentRequests: parseInt(process.env.CONCURRENT_REQUESTS) || 2,

    // Browser behavior
    scrollPage: parseBool(process.env.SCROLL_PAGE) !== false,
    interactWithPage: parseBool(process.env.INTERACT_WITH_PAGE) !== false,

    // API keys (for future use)
    cmcApiKey: process.env.CMC_API_KEY,
    cgApiKey: process.env.CG_API_KEY,

    // Platform flags
    coingeckoEnabled: parseBool(process.env.COINGECKO_ENABLED) || false,

    // Log levels: error, warn, info, debug
    logLevel: (process.env.LOG_LEVEL || 'info').toLowerCase()
};