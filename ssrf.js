/**
 * SSRF Protection — blocks requests to internal/private networks.
 */

const BLOCKED_HOSTS = [
    'localhost',
    '127.0.0.1',
    '[::1]',
    '0.0.0.0',
];

// Private IP ranges (CIDR-style check)
const PRIVATE_RANGES = [
    { prefix: '10.', },          // 10.0.0.0/8
    { prefix: '172.', min: 16, max: 31 }, // 172.16.0.0/12
    { prefix: '192.168.', },          // 192.168.0.0/16
    { prefix: '169.254.', },          // link-local
    { prefix: '0.', },          // 0.0.0.0/8
];

function isPrivateIP(hostname) {
    for (const range of PRIVATE_RANGES) {
        if (hostname.startsWith(range.prefix)) {
            if (range.min !== undefined) {
                const secondOctet = parseInt(hostname.split('.')[1], 10);
                if (secondOctet >= range.min && secondOctet <= range.max) return true;
            } else {
                return true;
            }
        }
    }
    return false;
}

/**
 * Validates and sanitises a URL for safe external fetching.
 * Returns { valid: true, url } or { valid: false, reason }.
 */
function validateUrl(raw) {
    if (!raw || typeof raw !== 'string') {
        return { valid: false, reason: 'URL is required' };
    }

    let parsed;
    try {
        parsed = new URL(raw.trim());
    } catch {
        return { valid: false, reason: 'Invalid URL format' };
    }

    // Only allow http(s)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { valid: false, reason: 'Only HTTP and HTTPS URLs are allowed' };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Direct blocklist
    if (BLOCKED_HOSTS.includes(hostname)) {
        return { valid: false, reason: 'Cannot monitor localhost or loopback addresses' };
    }

    // Private IP ranges
    if (isPrivateIP(hostname)) {
        return { valid: false, reason: 'Cannot monitor private/internal IP addresses' };
    }

    // Cloud metadata endpoints
    if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
        return { valid: false, reason: 'Cannot monitor cloud metadata endpoints' };
    }

    return { valid: true, url: parsed.href };
}

module.exports = { validateUrl };
