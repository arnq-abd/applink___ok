// ==================================================
//              CONFIGURATION & CONSTANTS
// ==================================================
const CONFIG = {
    TUNNEL_HEALTH_URL: 'https://architect.tailc7c6f8.ts.net/linkbd.vip/api/health.php',
    TUNNEL_APP_URL: 'https://architect.tailc7c6f8.ts.net/',
    CHECK_TIMEOUT_MS: 3800,
    TOTAL_COUNTDOWN_SECONDS: 3600, // 1 hour (১ ঘণ্টা)
    BACKGROUND_POLL_INTERVAL_MS: 45000, // 45 seconds auto-poll
    STORAGE_KEY_OFFLINE_EXPIRY: 'linkbd_offline_countdown_expiry'
};

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
            const data = await response.json().catch(() => null);
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
