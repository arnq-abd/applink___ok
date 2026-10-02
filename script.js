// ==================================================
//              CONFIGURATION & CONSTANTS
// ==================================================
const CONFIG = {
    TUNNEL_HEALTH_URL: 'linkbd.vip/api/health.php',
    TUNNEL_APP_URL: '',
    CHECK_TIMEOUT_MS: 3000,
    TOTAL_COUNTDOWN_SECONDS: 3600, // 1 hour
    STORAGE_KEY_OFFLINE_EXPIRY: 'linkbd_offline_countdown_expiry',
    STORAGE_KEY_CACHED_TUNNEL: 'linkbd_cached_tunnel_url',
    TUNNEL_SOURCE_API_RAW: 'https://api.github.com/repos/arnq-abd/applink___ok/contents/active_tunnel.json?ref=main',
    TUNNEL_SOURCE_LOCAL_JSON: './active_tunnel.json',
    TUNNEL_SOURCE_RAW: 'https://raw.githubusercontent.com/arnq-abd/applink___ok/main/active_tunnel.json'
};

// ==================================================
//               DOM ELEMENT REFERENCES
// ==================================================
const loaderContainer = document.getElementById('connection-loader');
const loaderTitle = document.querySelector('.loader-title');
const offlineShield = document.getElementById('offline-shield');
const onlinePopupModal = document.getElementById('online-popup-modal');
const redirectProgressBar = document.getElementById('redirect-progress-bar');
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
let offlineStartTime = 0;
let isTransitioningToLive = false;

// ==================================================
//             HELPER UTILITIES & CLEANERS
// ==================================================
function stripBomAndParseJson(text) {
    if (!text || typeof text !== 'string') return null;
    try {
        const clean = text.replace(/^\uFEFF/, '').trim();
        return JSON.parse(clean);
    } catch (e) {
        return null;
    }
}

function decodeBase64Utf8(b64) {
    if (!b64 || typeof b64 !== 'string') return '';
    try {
        const binStr = atob(b64.replace(/\s/g, ''));
        const bytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) {
            bytes[i] = binStr.charCodeAt(i);
        }
        const decoded = new TextDecoder('utf-8').decode(bytes);
        return decoded.replace(/^\uFEFF/, '').trim();
    } catch (e) {
        return '';
    }
}

function applyTunnelUrl(url) {
    if (!url || typeof url !== 'string') return false;
    let clean = url.trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
        clean = 'https://' + clean;
    }
    if (!clean.endsWith('/')) {
        clean += '/';
    }
    CONFIG.TUNNEL_APP_URL = clean;
    CONFIG.TUNNEL_HEALTH_URL = `${clean}linkbd.vip/api/health.php`;
    try {
        localStorage.setItem(CONFIG.STORAGE_KEY_CACHED_TUNNEL, clean);
    } catch (e) {}
    return true;
}

// ==================================================
//          FAST ZERO-LATENCY TUNNEL EXTRACTOR
// ==================================================
function extractTunnelFromUrl() {
    try {
        // 1. Hash priority (#tunnel=https://xxx.trycloudflare.com/)
        if (window.location.hash) {
            const match = window.location.hash.match(/tunnel=(https?:\/\/[^\s&#]+)/i);
            if (match && match[1]) {
                return decodeURIComponent(match[1]);
            }
        }
        // 2. Query search parameter (?tunnel=https://xxx.trycloudflare.com/)
        if (window.location.search) {
            const params = new URLSearchParams(window.location.search);
            const t = params.get('tunnel');
            if (t && /^https?:\/\//i.test(t)) {
                return t;
            }
        }
    } catch (e) {
        console.warn('Tunnel extraction error:', e);
    }
    return null;
}

// ==================================================
//             DYNAMIC TUNNEL RESOLVER
// ==================================================
async function resolveActiveTunnelUrl(forceFresh = false) {
    // 1. Instant check from URL query/hash (0ms delay)
    const directUrl = extractTunnelFromUrl();
    if (directUrl && applyTunnelUrl(directUrl)) {
        return true;
    }

    const timestamp = Date.now();

    // 2. Direct GitHub API with raw accept header (Bypasses Fastly 5-minute CDN cache!)
    try {
        const rawApiRes = await fetch(`${CONFIG.TUNNEL_SOURCE_API_RAW}&_t=${timestamp}`, {
            headers: {
                'Accept': 'application/vnd.github.v3.raw',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            },
            cache: 'no-store',
            mode: 'cors'
        });
        if (rawApiRes.ok) {
            const text = await rawApiRes.text();
            const data = stripBomAndParseJson(text);
            if (data && data.tunnel_url && applyTunnelUrl(data.tunnel_url)) {
                return true;
            }
        }
    } catch (e) {}

    // 3. GitHub API standard JSON with safe base64 utf-8 decoding
    try {
        const jsonApiRes = await fetch(`${CONFIG.TUNNEL_SOURCE_API_RAW}&_t=${timestamp}`, {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            },
            cache: 'no-store',
            mode: 'cors'
        });
        if (jsonApiRes.ok) {
            const apiJson = await jsonApiRes.json();
            if (apiJson && apiJson.content) {
                const decodedText = decodeBase64Utf8(apiJson.content);
                const data = stripBomAndParseJson(decodedText);
                if (data && data.tunnel_url && applyTunnelUrl(data.tunnel_url)) {
                    return true;
                }
            }
        }
    } catch (e) {}

    // 4. Same-origin GitHub Pages local active_tunnel.json
    try {
        const localRes = await fetch(`${CONFIG.TUNNEL_SOURCE_LOCAL_JSON}?_t=${timestamp}`, {
            cache: 'no-store'
        });
        if (localRes.ok) {
            const data = await localRes.json();
            if (data && data.tunnel_url && applyTunnelUrl(data.tunnel_url)) {
                return true;
            }
        }
    } catch (e) {}

    // 5. GitHub raw fallback with cache-busting
    try {
        const rawRes = await fetch(`${CONFIG.TUNNEL_SOURCE_RAW}?_t=${timestamp}`, {
            cache: 'no-store',
            mode: 'cors'
        });
        if (rawRes.ok) {
            const text = await rawRes.text();
            const data = stripBomAndParseJson(text);
            if (data && data.tunnel_url && applyTunnelUrl(data.tunnel_url)) {
                return true;
            }
        }
    } catch (e) {}

    // 6. LocalStorage cached tunnel as last resort
    if (!forceFresh) {
        const cached = localStorage.getItem(CONFIG.STORAGE_KEY_CACHED_TUNNEL);
        if (cached && applyTunnelUrl(cached)) {
            return true;
        }
    }

    return false;
}

// ==================================================
//            SERVER CONNECTIVITY TESTER
// ==================================================
async function checkServerStatus() {
    if (!CONFIG.TUNNEL_APP_URL) {
        const resolved = await resolveActiveTunnelUrl();
        if (!resolved || !CONFIG.TUNNEL_APP_URL) {
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
            let data = stripBomAndParseJson(rawText);
            if (!data) {
                const jsonMatch = rawText.match(/\{[\s\S]*"status"\s*:\s*"online"[\s\S]*\}/);
                if (jsonMatch) {
                    data = stripBomAndParseJson(jsonMatch[0]);
                }
            }
            return !!(data && data.status === 'online');
        }
        return false;
    } catch (error) {
        clearTimeout(timeoutId);
        return await testImageBeacon();
    }
}

// Secondary fallback beacon
function testImageBeacon() {
    if (!CONFIG.TUNNEL_APP_URL) {
        return Promise.resolve(false);
    }
    return new Promise((resolve) => {
        const img = new Image();
        const timeout = setTimeout(() => {
            img.src = '';
            resolve(false);
        }, 1800);

        img.onload = () => {
            clearTimeout(timeout);
            resolve(true);
        };

        img.onerror = () => {
            clearTimeout(timeout);
            resolve(false);
        };

        img.src = `${CONFIG.TUNNEL_APP_URL}favicon.ico?_b=${Date.now()}`;
    });
}

// ==================================================
//        SMOOTH TRANSITION & ZERO-BLACK SCREEN
// ==================================================
function revealLiveAppNow() {
    liveAppWrap.classList.remove('hidden');
    requestAnimationFrame(() => {
        liveAppWrap.classList.add('ready');
    });

    setTimeout(() => {
        loaderContainer.classList.add('hidden');
        offlineShield.classList.add('hidden');
        if (onlinePopupModal) {
            onlinePopupModal.classList.add('hidden');
        }
        isTransitioningToLive = false;
    }, 350);
}

function setOnlineState(wasWaitingOnOfflinePage = false) {
    if (isTransitioningToLive) return;
    isTransitioningToLive = true;
    isCurrentlyOnline = true;
    offlineStartTime = 0;

    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    try {
        localStorage.removeItem(CONFIG.STORAGE_KEY_OFFLINE_EXPIRY);
    } catch (e) {}

    // Prepare iframe loading behind current overlay
    let frameAlreadyLoaded = false;
    const targetUrl = CONFIG.TUNNEL_APP_URL;

    // Safety fallback timer so UI never hangs
    const safetyTimer = setTimeout(() => {
        revealLiveAppNow();
    }, wasWaitingOnOfflinePage ? 2400 : 2000);

    const onFrameLoadHandler = () => {
        if (!frameAlreadyLoaded) {
            frameAlreadyLoaded = true;
            clearTimeout(safetyTimer);
            if (wasWaitingOnOfflinePage) {
                // Wait for the redirect popup animation to complete
                setTimeout(revealLiveAppNow, 1200);
            } else {
                revealLiveAppNow();
            }
        }
    };

    liveFrame.onload = onFrameLoadHandler;

    if (!liveFrame.src || liveFrame.src === 'about:blank' || liveFrame.src !== targetUrl) {
        liveFrame.src = targetUrl;
    } else {
        // Iframe was already set
        onFrameLoadHandler();
    }

    if (wasWaitingOnOfflinePage) {
        // User was on the offline countdown page: show the redirect notice modal
        if (onlinePopupModal) {
            onlinePopupModal.classList.remove('hidden');
            if (redirectProgressBar) {
                redirectProgressBar.style.width = '0%';
                requestAnimationFrame(() => {
                    redirectProgressBar.style.width = '100%';
                });
            }
        }
    } else {
        // User was looking at the initial checking spinner
        if (loaderTitle) {
            loaderTitle.textContent = 'সার্ভার প্রস্তুত, লাইভ পোর্টাল লোড হচ্ছে...';
        }
    }
}

function setOfflineState() {
    isCurrentlyOnline = false;
    isTransitioningToLive = false;
    if (!offlineStartTime) {
        offlineStartTime = Date.now();
    }

    loaderContainer.classList.add('hidden');
    liveAppWrap.classList.remove('ready');
    liveAppWrap.classList.add('hidden');
    if (onlinePopupModal) {
        onlinePopupModal.classList.add('hidden');
    }
    offlineShield.classList.remove('hidden');

    if (liveFrame.src && liveFrame.src !== 'about:blank') {
        liveFrame.src = 'about:blank';
    }

    startOneHourCountdown();
}

function showCheckingLoader() {
    if (loaderTitle) {
        loaderTitle.textContent = 'সার্ভার সংযোগ যাচাই করা হচ্ছে...';
    }
    loaderContainer.classList.remove('hidden');
    offlineShield.classList.add('hidden');
    if (onlinePopupModal) {
        onlinePopupModal.classList.add('hidden');
    }
    liveAppWrap.classList.add('hidden');
    liveAppWrap.classList.remove('ready');
}

// ==================================================
//         COUNTDOWN TIMER & AUTO-RECOVERY
// ==================================================
function startOneHourCountdown() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }

    const now = Date.now();
    let targetExpiry = parseInt(localStorage.getItem(CONFIG.STORAGE_KEY_OFFLINE_EXPIRY), 10);

    if (!targetExpiry || targetExpiry <= now || targetExpiry > now + (CONFIG.TOTAL_COUNTDOWN_SECONDS + 60) * 1000) {
        targetExpiry = now + CONFIG.TOTAL_COUNTDOWN_SECONDS * 1000;
        try {
            localStorage.setItem(CONFIG.STORAGE_KEY_OFFLINE_EXPIRY, targetExpiry.toString());
        } catch (e) {}
    }

    updateTimerDisplay(targetExpiry);

    countdownInterval = setInterval(() => {
        const remainingMs = targetExpiry - Date.now();

        if (remainingMs <= 0) {
            clearInterval(countdownInterval);
            countdownInterval = null;
            try {
                localStorage.removeItem(CONFIG.STORAGE_KEY_OFFLINE_EXPIRY);
            } catch (e) {}
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

    if (timerProgressBar) {
        const percent = Math.min(100, Math.max(0, (totalRemaining / CONFIG.TOTAL_COUNTDOWN_SECONDS) * 100));
        timerProgressBar.style.width = `${percent}%`;
    }
}

// ==================================================
//       RAPID AUTO-POLL & ZERO-DELAY WATCHER
// ==================================================
function scheduleNextPoll() {
    if (backgroundPollTimer) {
        clearTimeout(backgroundPollTimer);
    }

    // Dynamic poll interval:
    // If just went offline (within 30 seconds): poll aggressively every 2 seconds!
    // After 30 seconds: poll every 5 seconds.
    const elapsed = offlineStartTime ? (Date.now() - offlineStartTime) : 0;
    const intervalMs = elapsed < 30000 ? 2000 : 5000;

    backgroundPollTimer = setTimeout(async () => {
        if (!isCurrentlyOnline) {
            await resolveActiveTunnelUrl(true);
            const online = await checkServerStatus();
            if (online) {
                // Was waiting on the offline page!
                setOnlineState(true);
                return;
            }
        }
        if (!isCurrentlyOnline) {
            scheduleNextPoll();
        }
    }, intervalMs);
}

// ==================================================
//             INITIALIZATION & EVENT HANDLERS
// ==================================================
async function attemptConnection() {
    const isCurrentlyShowingOffline = !offlineShield.classList.contains('hidden');
    if (!isCurrentlyShowingOffline) {
        showCheckingLoader();
    }
    await resolveActiveTunnelUrl();
    const online = await checkServerStatus();

    if (online) {
        setOnlineState(isCurrentlyShowingOffline);
    } else {
        setOfflineState();
        scheduleNextPoll();
    }
}

// Retry Button Trigger
if (btnRetry) {
    btnRetry.addEventListener('click', async () => {
        const btnText = btnRetry.querySelector('.btn-text');
        const originalText = btnText ? btnText.textContent : 'এখনই পুনরায় চেষ্টা করুন';
        if (btnText) btnText.textContent = 'যাচাই চলছে...';
        btnRetry.style.pointerEvents = 'none';
        btnRetry.style.opacity = '0.7';

        await resolveActiveTunnelUrl(true);
        const online = await checkServerStatus();

        if (online) {
            setOnlineState(true);
        } else {
            setOfflineState();
            scheduleNextPoll();
            offlineShield.querySelector('.offline-card')?.animate([
                { transform: 'translateX(-4px)' },
                { transform: 'translateX(4px)' },
                { transform: 'translateX(0)' }
            ], { duration: 250 });
        }

        if (btnText) btnText.textContent = originalText;
        btnRetry.style.pointerEvents = 'auto';
        btnRetry.style.opacity = '1';
    });
}

// Update Copyright Year
if (currentYearSpan) {
    currentYearSpan.textContent = new Date().getFullYear();
}

// Window hashchange listener: instant response if launcher reloads with new tunnel hash
window.addEventListener('hashchange', () => {
    const directUrl = extractTunnelFromUrl();
    if (directUrl && applyTunnelUrl(directUrl)) {
        attemptConnection();
    }
});

// Document Ready
document.addEventListener('DOMContentLoaded', () => {
    attemptConnection();
});
