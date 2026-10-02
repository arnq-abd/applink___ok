// ==================================================
//              CONFIGURATION & CONSTANTS
// ==================================================
const CONFIG = {
    TUNNEL_HEALTH_URL: 'linkbd.vip/api/health.php',
    TUNNEL_APP_URL: '',
    CHECK_TIMEOUT_MS: 4000,
    TOTAL_COUNTDOWN_SECONDS: 3600, // 1 hour (১ ঘণ্টা)
    BACKGROUND_POLL_INTERVAL_MS: 45000, // 45 seconds auto-poll
    STORAGE_KEY_OFFLINE_EXPIRY: 'linkbd_offline_countdown_expiry',
    TUNNEL_SOURCE_RAW: 'https://raw.githubusercontent.com/arnq-abd/applink___ok/main/active_tunnel.json',
    TUNNEL_SOURCE_API: 'https://api.github.com/repos/arnq-abd/applink___ok/contents/active_tunnel.json'
};

// ==================================================
//             DYNAMIC TUNNEL RESOLVER
// ==================================================
async function resolveActiveTunnelUrl() {
    const timestamp = Date.now();
    
    // 1. Try fast GitHub raw endpoint with cache-busting query
    try {
        const rawRes = await fetch(`${CONFIG.TUNNEL_SOURCE_RAW}?_cb=${timestamp}`, {
            cache: 'no-store',
            mode: 'cors'
        });
        if (rawRes.ok) {
            const data = await rawRes.json().catch(() => null);
            if (data && data.tunnel_url && typeof data.tunnel_url === 'string') {
                applyTunnelUrl(data.tunnel_url);
                return;
            }
        }
    } catch (e) {
        // Continue to API fallback
    }

    // 2. Secondary fallback using GitHub API contents
    try {
        const apiRes = await fetch(`${CONFIG.TUNNEL_SOURCE_API}?_cb=${timestamp}`, {
            cache: 'no-store',
            mode: 'cors'
        });
        if (apiRes.ok) {
            const apiJson = await apiRes.json().catch(() => null);
            if (apiJson && apiJson.content) {
                const decoded = atob(apiJson.content.replace(/\s/g, ''));
                const parsed = JSON.parse(decoded);
                if (parsed && parsed.tunnel_url && typeof parsed.tunnel_url === 'string') {
                    applyTunnelUrl(parsed.tunnel_url);
                    return;
                }
            }
        }
    } catch (e) {
        // Fallback remains as is
    }
}

function applyTunnelUrl(url) {
    let clean = url.trim();
    if (!clean.endsWith('/')) {
        clean += '/';
    }
    CONFIG.TUNNEL_APP_URL = clean;
    CONFIG.TUNNEL_HEALTH_URL = `${clean}linkbd.vip/api/health.php`;
}

// ==================================================
//               DOM ELEMENT REFERENCES
// ==================================================
const loaderContainer = document.getElementById('connection-loader');
const offlineShield = document.getElementById('offline-shield');
const liveAppWrap = document.getElementById('live-app-wrap');
const liveFrame = document.getElementById('live-frame');

const timerHours = document.getElementById('timer-hours');
const timerMinutes = document.getElementById('timer-minutes');
const timerSeconds = document.getElementById('timer-seconds');
const timerProgressBar = document.getElementById('timer-progress-bar');

const btnRetry = document.getElementById('btn-retry');
const currentYearSpan = document.getElementById('current-year');

let countdownInterval = null;
let backgroundPollTimer = null;
let isCurrentlyOnline = false;

// ==================================================
//            SERVER CONNECTIVITY TESTER
// ==================================================
async function checkServerStatus() {
    if (!CONFIG.TUNNEL_APP_URL) {
        await resolveActiveTunnelUrl();
        if (!CONFIG.TUNNEL_APP_URL) {
            return false;
        }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.CHECK_TIMEOUT_MS);

    try {
        const pingUrl = `${CONFIG.TUNNEL_HEALTH_URL}?_t=${Date.now()}`;
        const response = await fetch(pingUrl, {
            method: 'GET',
            mode: 'cors',
            cache: 'no-store',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const rawText = await response.text().catch(() => '');
            let data = null;
            try {
                data = JSON.parse(rawText);
            } catch (e) {
                const jsonMatch = rawText.match(/\{[\s\S]*"status"\s*:\s*"online"[\s\S]*\}/);
                if (jsonMatch) {
                    try { data = JSON.parse(jsonMatch[0]); } catch (e2) {}
                }
            }
            return data && data.status === 'online';
        }
        return false;
    } catch (error) {
        clearTimeout(timeoutId);
        // Fallback check using Image beacon to ensure no false negatives due to network quirks
        return await testImageBeacon();
    }
}

// Fallback secondary test using an image beacon
function testImageBeacon() {
    if (!CONFIG.TUNNEL_APP_URL) {
        return Promise.resolve(false);
    }
    return new Promise((resolve) => {
        const img = new Image();
        const timeout = setTimeout(() => {
            img.src = '';
            resolve(false);
        }, 2500);

        img.onload = () => {
            clearTimeout(timeout);
            resolve(true);
        };

        img.onerror = () => {
            clearTimeout(timeout);
            // Even if 404, if server responded, connection reached the PC
            resolve(false);
        };

        img.src = `${CONFIG.TUNNEL_APP_URL}favicon.ico?_b=${Date.now()}`;
    });
}

// ==================================================
//              STATE TRANSITION LOGIC
// ==================================================
function setOnlineState() {
    isCurrentlyOnline = true;
    clearInterval(countdownInterval);
    countdownInterval = null;
    localStorage.removeItem(CONFIG.STORAGE_KEY_OFFLINE_EXPIRY);

    loaderContainer.classList.add('hidden');
    offlineShield.classList.add('hidden');
    liveAppWrap.classList.remove('hidden');

    if (!liveFrame.src || liveFrame.src === 'about:blank') {
        liveFrame.src = CONFIG.TUNNEL_APP_URL;
    }
}

function setOfflineState() {
    isCurrentlyOnline = false;
    loaderContainer.classList.add('hidden');
    liveAppWrap.classList.add('hidden');
    offlineShield.classList.remove('hidden');

    // Free iframe resources while offline
    if (liveFrame.src && liveFrame.src !== 'about:blank') {
        liveFrame.src = 'about:blank';
    }

    startOneHourCountdown();
}

function showCheckingLoader() {
    loaderContainer.classList.remove('hidden');
    offlineShield.classList.add('hidden');
    liveAppWrap.classList.add('hidden');
}

// ==================================================
//         1-HOUR COUNTDOWN & PERSISTENCE
// ==================================================
function startOneHourCountdown() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }

    const now = Date.now();
    let targetExpiry = parseInt(localStorage.getItem(CONFIG.STORAGE_KEY_OFFLINE_EXPIRY), 10);

    // If no target set or target is in the past, set fresh 1 hour
    if (!targetExpiry || targetExpiry <= now || targetExpiry > now + (CONFIG.TOTAL_COUNTDOWN_SECONDS + 60) * 1000) {
        targetExpiry = now + CONFIG.TOTAL_COUNTDOWN_SECONDS * 1000;
        localStorage.setItem(CONFIG.STORAGE_KEY_OFFLINE_EXPIRY, targetExpiry.toString());
    }

    updateTimerDisplay(targetExpiry);

    countdownInterval = setInterval(() => {
        const remainingMs = targetExpiry - Date.now();

        if (remainingMs <= 0) {
            clearInterval(countdownInterval);
            countdownInterval = null;
            localStorage.removeItem(CONFIG.STORAGE_KEY_OFFLINE_EXPIRY);
            // When timer reaches 0, auto-attempt re-connection
            attemptConnection();
            return;
        }

        updateTimerDisplay(targetExpiry);
    }, 1000);
}

function updateTimerDisplay(targetExpiry) {
    const totalRemaining = Math.max(0, Math.floor((targetExpiry - Date.now()) / 1000));

    const hours = Math.floor(totalRemaining / 3600);
    const minutes = Math.floor((totalRemaining % 3600) / 60);
    const seconds = totalRemaining % 60;

    if (timerHours) timerHours.textContent = String(hours).padStart(2, '0');
    if (timerMinutes) timerMinutes.textContent = String(minutes).padStart(2, '0');
    if (timerSeconds) timerSeconds.textContent = String(seconds).padStart(2, '0');

    // Progress bar width
    if (timerProgressBar) {
        const percent = Math.min(100, Math.max(0, (totalRemaining / CONFIG.TOTAL_COUNTDOWN_SECONDS) * 100));
        timerProgressBar.style.width = `${percent}%`;
    }
}

// ==================================================
//             INITIALIZATION & EVENT HANDLERS
// ==================================================
async function attemptConnection() {
    showCheckingLoader();
    await resolveActiveTunnelUrl();
    const online = await checkServerStatus();

    if (online) {
        setOnlineState();
    } else {
        setOfflineState();
    }
}

// Retry Button Trigger
if (btnRetry) {
    btnRetry.addEventListener('click', async () => {
        const originalText = btnRetry.querySelector('.btn-text').textContent;
        btnRetry.querySelector('.btn-text').textContent = 'যাচাই চলছে...';
        btnRetry.style.pointerEvents = 'none';
        btnRetry.style.opacity = '0.7';

        await resolveActiveTunnelUrl();
        const online = await checkServerStatus();

        if (online) {
            setOnlineState();
        } else {
            setOfflineState();
            // brief shake feedback
            offlineShield.querySelector('.offline-card').animate([
                { transform: 'translateX(-4px)' },
                { transform: 'translateX(4px)' },
                { transform: 'translateX(0)' }
            ], { duration: 250 });
        }

        btnRetry.querySelector('.btn-text').textContent = originalText;
        btnRetry.style.pointerEvents = 'auto';
        btnRetry.style.opacity = '1';
    });
}

// Background auto-polling (checks every 45s if offline)
backgroundPollTimer = setInterval(async () => {
    if (!isCurrentlyOnline) {
        await resolveActiveTunnelUrl();
        const online = await checkServerStatus();
        if (online) {
            setOnlineState();
        }
    }
}, CONFIG.BACKGROUND_POLL_INTERVAL_MS);

// Update Copyright Year
if (currentYearSpan) {
    currentYearSpan.textContent = new Date().getFullYear();
}

// Document Ready
document.addEventListener('DOMContentLoaded', () => {
    attemptConnection();
});
