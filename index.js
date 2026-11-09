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

    console.log("[*] Launching browser with US Proxy & America/New_York timezone...");
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
            '--lang=en-US,en',
            `--proxy-server=${anonymizedProxyUrl}`
        ],
        env: {
            ...process.env,
            TZ: 'America/New_York'
        }
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Emulate New York Timezone directly via CDP session
    await page.emulateTimezone('America/New_York');

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

    // Find input field
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

    // Wait for OTP boxes to appear
    await new Promise(r => setTimeout(r, 6000));
    await page.screenshot({ path: 'debug_otp_ready.png' });

    // Ask user for the Gmail OTP
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

    console.log("[*] Waiting for Birthday / Next screen...");
    await new Promise(r => setTimeout(r, 6000));
    await page.screenshot({ path: 'debug_birthday_screen.png' });
    console.log("[*] Saved debug_birthday_screen.png!");

    await askQuestion("[?] Press Enter after checking debug_birthday_screen to exit...");
    await browser.close();
    await proxyChain.closeAnonymizedProxy(anonymizedProxyUrl, true);
    rl.close();
}

runWorkflow();
