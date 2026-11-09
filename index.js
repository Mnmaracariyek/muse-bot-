const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const proxyChain = require('proxy-chain');
const readline = require('readline');

puppeteer.use(StealthPlugin());

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

const PROXY_URL = 'socks5://proxyuser:Apatiyoo@54.226.65.96:1080';

async function runWorkflow() {
    console.log("[*] Creating local proxy tunnel via proxy-chain...");
    const anonymizedProxyUrl = await proxyChain.anonymizeProxy(PROXY_URL);
    console.log(`[*] Local tunnel ready at: ${anonymizedProxyUrl}`);

    console.log("[*] Launching browser with WebRTC & DNS Leak Protection...");
    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--window-size=1280,800',
            '--lang=en-US',
            `--proxy-server=${anonymizedProxyUrl}`,
            // WebRTC Leak 100% නවත්තන flags:
            '--webrtc-ip-handling-policy=disable_non_proxied_udp',
            '--force-webrtc-ip-handling-policy',
            '--disable-features=WebRtcHideLocalIpsWithMdns,Ipv6'
        ],
        env: {
            ...process.env,
            TZ: 'America/New_York',
            LANG: 'en_US.UTF-8',
            LC_ALL: 'en_US.UTF-8'
        }
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    // Force US Headers
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9'
    });

    // Emulate New York Timezone & US Geolocation
    await page.emulateTimezone('America/New_York');

    // Override navigator properties & completely kill WebRTC in JS context
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'language', { get: () => 'en-US' });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        
        // Block WebRTC completely so real Singapore IP never leaks
        window.RTCPeerConnection = undefined;
        window.webkitRTCPeerConnection = undefined;
        if (navigator.mediaDevices) {
            navigator.mediaDevices.getUserMedia = undefined;
        }
    });

    console.log("[*] Checking IP and timezone through proxy...");
    try {
        await page.goto('https://ipinfo.io/json', { waitUntil: 'networkidle2', timeout: 30000 });
        const ipInfo = await page.evaluate(() => document.body.innerText);
        console.log("[*] IP Check Response:\n", ipInfo);
    } catch (e) {
        console.log("[-] Warning: Failed to check ipinfo:", e.message);
    }

    console.log("[*] Navigating to muse.ai/#weblink...");
    await page.goto('https://muse.ai/#weblink', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 4000));

    let emailInput = null;
    let targetFrame = page;
    for (const frame of page.frames()) {
        try {
            const el = await frame.$('input');
            if (el) {
                targetFrame = frame;
                emailInput = el;
                break;
            }
        } catch (e) {}
    }

    if (!emailInput) {
        console.log("[-] Could not find email input. Taking debug screenshot...");
        await page.screenshot({ path: 'debug_proxy_error.png' });
        await browser.close();
        await proxyChain.closeAnonymizedProxy(anonymizedProxyUrl, true);
        rl.close();
        return;
    }

    const targetEmail = await askQuestion("[?] Enter your primary Gmail address: ");
    await emailInput.type(targetEmail, { delay: 100 });
    await page.keyboard.press('Enter');
    console.log("[*] Submitted email. Waiting for OTP screen...");

    await new Promise(r => setTimeout(r, 6000));
    await page.screenshot({ path: 'debug_otp_ready.png' });

    const otpCode = await askQuestion("[?] Enter the 6-digit OTP received on Gmail: ");
    console.log(`[*] Typing OTP: ${otpCode}...`);

    const inputs = await targetFrame.$$('input');
    if (inputs.length > 0) {
        await inputs[0].focus();
        await page.keyboard.type(otpCode.trim(), { delay: 150 });
    }

    await new Promise(r => setTimeout(r, 2000));

    console.log("[*] Clicking Confirm button...");
    await page.keyboard.press('Enter');

    console.log("[*] Waiting for Birthday screen...");
    await new Promise(r => setTimeout(r, 6000));
    await page.screenshot({ path: 'debug_birthday_screen.png' });
    console.log("[*] Saved debug_birthday_screen.png!");

    await askQuestion("[?] Press Enter after checking debug_birthday_screen to exit...");
    await browser.close();
    await proxyChain.closeAnonymizedProxy(anonymizedProxyUrl, true);
    rl.close();
}

runWorkflow();
