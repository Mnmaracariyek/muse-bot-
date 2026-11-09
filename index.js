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

// socks5h forces DNS resolution to happen on the US Proxy server, NOT Singapore!
const PROXY_URL = 'socks5://proxyuser:Apatiyoo@54.226.65.96:1080';

async function runWorkflow() {
    console.log("[*] Creating local proxy tunnel...");
    const anonymizedProxyUrl = await proxyChain.anonymizeProxy(PROXY_URL);

    console.log("[*] Launching browser with strict US config...");
    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1280,800',
            '--lang=en-US',
            `--proxy-server=${anonymizedProxyUrl}`,
            '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1',
            '--webrtc-ip-handling-policy=disable_non_proxied_udp',
            '--force-webrtc-ip-handling-policy'
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

    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9'
    });

    await page.emulateTimezone('America/New_York');

    // Force US locale on all frames
    const client = await page.target().createCDPSession();
    await client.send('Emulation.setTimezoneOverride', { timezoneId: 'America/New_York' });
    await client.send('Emulation.setLocaleOverride', { locale: 'en-US' });

    console.log("[*] Navigating directly to muse.ai/#weblink...");
    await page.goto('https://muse.ai/#weblink', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 5000));

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
        console.log("[-] Email input not found. Saving debug screenshot...");
        await page.screenshot({ path: 'debug_proxy_error.png' });
        await browser.close();
        await proxyChain.closeAnonymizedProxy(anonymizedProxyUrl, true);
        rl.close();
        return;
    }

    console.log("\n[!] IMPORTANT: Use a fresh alias like nimsarahhnaviduhj+us5@gmail.com !");
    const targetEmail = await askQuestion("[?] Enter Gmail address: ");
    await emailInput.type(targetEmail.trim(), { delay: 100 });
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
