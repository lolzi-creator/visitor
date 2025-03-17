// proxy.js
const fs = require('fs');
const path = require('path');

class ProxyManager {
    constructor(proxyListPath = 'proxies.txt') {
        this.proxyListPath = proxyListPath;
        this.proxies = [];
        this.currentIndex = 0;
        this.loadProxies();
    }

    loadProxies() {
        try {
            if (fs.existsSync(this.proxyListPath)) {
                const content = fs.readFileSync(this.proxyListPath, 'utf8');
                this.proxies = content
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('#'));

                console.log(`Loaded ${this.proxies.length} proxies from ${this.proxyListPath}`);
            } else {
                console.warn(`Proxy file ${this.proxyListPath} not found. Running without proxies.`);
            }
        } catch (error) {
            console.error(`Error loading proxies: ${error.message}`);
        }
    }

    getNextProxy() {
        if (this.proxies.length === 0) {
            return null;
        }

        const proxy = this.proxies[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
        return proxy;
    }

    getProxyConfig() {
        const proxy = this.getNextProxy();
        if (!proxy) {
            return null;
        }

        // Parse proxy string (format: protocol://user:pass@host:port)
        try {
            const proxyUrl = new URL(proxy);
            return {
                protocol: proxyUrl.protocol.replace(':', ''),
                host: proxyUrl.hostname,
                port: parseInt(proxyUrl.port),
                auth: proxyUrl.username ? {
                    username: proxyUrl.username,
                    password: proxyUrl.password
                } : undefined
            };
        } catch (error) {
            // For simpler format like host:port
            if (proxy.includes(':')) {
                const [host, port] = proxy.split(':');
                return {
                    host,
                    port: parseInt(port)
                };
            }
            console.error(`Invalid proxy format: ${proxy}`);
            return null;
        }
    }
}

module.exports = ProxyManager;