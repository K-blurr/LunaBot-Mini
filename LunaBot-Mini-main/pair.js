// pair.js - COMPLETELY FIXED with 3 minute timeout
const express = require('express');
const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const { Boom } = require('@hapi/boom');

const app = express();
const PORT = process.env.PORT || 3000;

// Store active sessions
const activeSessions = new Map();

// Create sessions folder
if (!fs.existsSync('./sessions')) {
    fs.mkdirSync('./sessions');
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the pairing page
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>LunaBot Mini - Pairing</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 20px;
            }
            
            .container {
                max-width: 500px;
                width: 100%;
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(10px);
                border-radius: 30px;
                padding: 30px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            }
            
            h1 {
                text-align: center;
                color: #333;
                font-size: 28px;
                margin-bottom: 10px;
            }
            
            h1 span {
                color: #667eea;
            }
            
            .subtitle {
                text-align: center;
                color: #666;
                margin-bottom: 30px;
                font-size: 14px;
            }
            
            .mode-switch {
                display: flex;
                background: #f0f0f0;
                border-radius: 50px;
                padding: 5px;
                margin-bottom: 30px;
            }
            
            .mode-btn {
                flex: 1;
                padding: 12px;
                border: none;
                background: transparent;
                border-radius: 50px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s;
                color: #666;
            }
            
            .mode-btn.active {
                background: white;
                color: #667eea;
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
            }
            
            .mode-content {
                display: none;
                animation: fadeIn 0.5s;
            }
            
            .mode-content.active {
                display: block;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            .form-group {
                margin-bottom: 20px;
            }
            
            label {
                display: block;
                margin-bottom: 8px;
                color: #555;
                font-weight: 500;
                font-size: 14px;
            }
            
            input {
                width: 100%;
                padding: 15px;
                border: 2px solid #e0e0e0;
                border-radius: 12px;
                font-size: 16px;
                transition: all 0.3s;
                background: white;
            }
            
            input:focus {
                outline: none;
                border-color: #667eea;
                box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
            }
            
            button {
                width: 100%;
                padding: 15px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 12px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: transform 0.2s, box-shadow 0.2s;
            }
            
            button:hover {
                transform: translateY(-2px);
                box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
            }
            
            button:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none;
            }
            
            .qr-container {
                background: #f8f9fa;
                border-radius: 20px;
                padding: 30px;
                text-align: center;
                margin: 20px 0;
                min-height: 300px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
            }
            
            .qr-placeholder {
                color: #999;
                font-size: 14px;
            }
            
            .qr-code {
                max-width: 250px;
                margin: 0 auto;
            }
            
            .qr-code img {
                width: 100%;
                height: auto;
                border-radius: 10px;
            }
            
            .pairing-code {
                background: #f8f9fa;
                border: 2px dashed #667eea;
                padding: 20px;
                font-size: 32px;
                font-family: monospace;
                text-align: center;
                letter-spacing: 8px;
                margin: 20px 0;
                border-radius: 12px;
                font-weight: bold;
            }
            
            .copy-btn {
                background: #28a745;
                margin-top: 10px;
                padding: 12px;
                font-size: 14px;
            }
            
            .copy-btn:hover {
                background: #218838;
            }
            
            .loading {
                display: none;
                text-align: center;
                margin: 20px 0;
            }
            
            .spinner {
                border: 4px solid #f3f3f3;
                border-top: 4px solid #667eea;
                border-radius: 50%;
                width: 50px;
                height: 50px;
                animation: spin 1s linear infinite;
                margin: 0 auto 15px;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .result {
                margin-top: 20px;
                padding: 15px;
                border-radius: 12px;
                display: none;
            }
            
            .result.success {
                background: #d4edda;
                border: 1px solid #c3e6cb;
                color: #155724;
                display: block;
            }
            
            .result.error {
                background: #f8d7da;
                border: 1px solid #f5c6cb;
                color: #721c24;
                display: block;
            }
            
            .info-text {
                font-size: 12px;
                color: #888;
                margin-top: 5px;
            }
            
            .footer {
                text-align: center;
                margin-top: 30px;
                color: #888;
                font-size: 12px;
                border-top: 1px solid #e0e0e0;
                padding-top: 20px;
            }
            
            .footer a {
                color: #667eea;
                text-decoration: none;
            }
            
            .footer a:hover {
                text-decoration: underline;
            }
            
            .warning-box {
                background: #fff3cd;
                border: 1px solid #ffeeba;
                color: #856404;
                padding: 15px;
                border-radius: 12px;
                margin: 20px 0;
                font-size: 14px;
                text-align: center;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🌙 LunaBot <span>Mini</span></h1>
            <div class="subtitle">Link your WhatsApp device</div>
            
            <div class="mode-switch">
                <button class="mode-btn active" onclick="switchMode('pair')">Pair Code</button>
                <button class="mode-btn" onclick="switchMode('qr')">QR Code</button>
            </div>
            
            <!-- Pair Code Mode -->
            <div id="pairMode" class="mode-content active">
                <form id="pairForm" onsubmit="event.preventDefault(); generatePair();">
                    <div class="form-group">
                        <label>Enter your WhatsApp number with country code</label>
                        <input type="tel" id="phone" placeholder="233546785467" required>
                        <div class="info-text">Example: 234 for Nigeria, 233 for Ghana, 91 for India, 1 for USA</div>
                    </div>
                    
                    <button type="submit" id="pairBtn">Generate Pair Code</button>
                </form>
                
                <div class="loading" id="pairLoading">
                    <div class="spinner"></div>
                    <p>Connecting to WhatsApp...</p>
                    <p style="font-size: 12px; color: #666;">This may take 10-20 seconds</p>
                </div>
                
                <div id="pairResult" class="result"></div>
                <div id="pairCodeDisplay" style="display: none;">
                    <div class="pairing-code" id="pairCode"></div>
                    <button class="copy-btn" onclick="copyPairCode()">Copy Code</button>
                    <div class="warning-box" style="margin-top: 15px;">
                        ⏳ After entering this code in WhatsApp, wait 2-3 minutes for the session ID to arrive in your DM
                    </div>
                </div>
            </div>
            
            <!-- QR Code Mode -->
            <div id="qrMode" class="mode-content">
                <form id="qrForm" onsubmit="event.preventDefault(); generateQR();">
                    <div class="form-group">
                        <label>Enter your WhatsApp number with country code</label>
                        <input type="tel" id="qrPhone" placeholder="2348012345678" required>
                        <div class="info-text">Example: 234 for Nigeria, 233 for Ghana, 91 for India, 1 for USA</div>
                    </div>
                    
                    <button type="submit" id="qrBtn">Generate QR Code</button>
                </form>
                
                <div class="loading" id="qrLoading">
                    <div class="spinner"></div>
                    <p>Generating QR code...</p>
                </div>
                
                <div class="qr-container" id="qrContainer">
                    <div class="qr-placeholder" id="qrPlaceholder">Your QR code will appear here</div>
                    <div id="qrCode" style="display: none;"></div>
                </div>
                
                <div id="qrResult" class="result"></div>
            </div>
            
            <div class="footer">
                © 2026 Kobby Blurr | LunaBot Mini
            </div>
        </div>
        
        <script>
            let currentPairCode = '';
            
            function switchMode(mode) {
                document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
                event.target.classList.add('active');
                
                document.getElementById('pairMode').classList.remove('active');
                document.getElementById('qrMode').classList.remove('active');
                
                if (mode === 'pair') {
                    document.getElementById('pairMode').classList.add('active');
                } else {
                    document.getElementById('qrMode').classList.add('active');
                }
            }
            
            async function generatePair() {
                const phone = document.getElementById('phone').value.trim();
                const pairBtn = document.getElementById('pairBtn');
                const loading = document.getElementById('pairLoading');
                const result = document.getElementById('pairResult');
                const codeDisplay = document.getElementById('pairCodeDisplay');
                const pairForm = document.getElementById('pairForm');
                
                if (!phone) {
                    showResult('pairResult', 'error', 'Please enter your phone number');
                    return;
                }
                
                if (!/^\\d+$/.test(phone)) {
                    showResult('pairResult', 'error', 'Only numbers allowed (no spaces, no +)');
                    return;
                }
                
                if (phone.length < 10 || phone.length > 15) {
                    showResult('pairResult', 'error', 'Phone number should be 10-15 digits');
                    return;
                }
                
                pairBtn.disabled = true;
                loading.style.display = 'block';
                result.style.display = 'none';
                codeDisplay.style.display = 'none';
                
                try {
                    const response = await fetch('/pair', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phone: phone })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        currentPairCode = data.code;
                        document.getElementById('pairCode').innerText = data.code;
                        codeDisplay.style.display = 'block';
                        pairForm.style.display = 'none';
                        
                        // Show waiting message
                        showResult('pairResult', 'success', '✅ Code generated! Enter it in WhatsApp and wait 2-3 minutes for session ID in your DM');
                    } else {
                        showResult('pairResult', 'error', data.message || 'Failed to generate code');
                        pairBtn.disabled = false;
                        loading.style.display = 'none';
                    }
                } catch (error) {
                    showResult('pairResult', 'error', 'Server error. Please try again.');
                    pairBtn.disabled = false;
                    loading.style.display = 'none';
                }
            }
            
            async function generateQR() {
                const phone = document.getElementById('qrPhone').value.trim();
                const qrBtn = document.getElementById('qrBtn');
                const loading = document.getElementById('qrLoading');
                const qrContainer = document.getElementById('qrContainer');
                const qrPlaceholder = document.getElementById('qrPlaceholder');
                const qrCode = document.getElementById('qrCode');
                const qrResult = document.getElementById('qrResult');
                const qrForm = document.getElementById('qrForm');
                
                if (!phone) {
                    qrResult.className = 'result error';
                    qrResult.innerHTML = 'Please enter your phone number';
                    qrResult.style.display = 'block';
                    return;
                }
                
                if (!/^\\d+$/.test(phone)) {
                    qrResult.className = 'result error';
                    qrResult.innerHTML = 'Only numbers allowed (no spaces, no +)';
                    qrResult.style.display = 'block';
                    return;
                }
                
                qrBtn.disabled = true;
                loading.style.display = 'block';
                qrPlaceholder.style.display = 'none';
                qrCode.style.display = 'none';
                qrResult.style.display = 'none';
                
                try {
                    const response = await fetch('/qr', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phone: phone })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        qrCode.innerHTML = '<img src="' + data.qr + '" alt="QR Code" style="width: 100%;">';
                        qrCode.style.display = 'block';
                        qrForm.style.display = 'none';
                        
                        qrResult.className = 'result success';
                        qrResult.innerHTML = '✅ Scan this QR code with WhatsApp';
                        qrResult.style.display = 'block';
                    } else {
                        qrPlaceholder.innerText = data.message || 'Failed to generate QR';
                        qrPlaceholder.style.display = 'block';
                        qrBtn.disabled = false;
                        
                        qrResult.className = 'result error';
                        qrResult.innerHTML = data.message || 'Failed to generate QR';
                        qrResult.style.display = 'block';
                    }
                } catch (error) {
                    qrPlaceholder.innerText = 'Server error. Please try again.';
                    qrPlaceholder.style.display = 'block';
                    qrBtn.disabled = false;
                    
                    qrResult.className = 'result error';
                    qrResult.innerHTML = 'Server error. Please try again.';
                    qrResult.style.display = 'block';
                } finally {
                    loading.style.display = 'none';
                }
            }
            
            function copyPairCode() {
                navigator.clipboard.writeText(currentPairCode).then(() => {
                    alert('Code copied to clipboard!');
                }).catch(() => {
                    alert('Failed to copy. Please select and copy manually.');
                });
            }
            
            function showResult(elementId, type, message) {
                const result = document.getElementById(elementId);
                result.className = 'result ' + type;
                result.innerHTML = message;
                result.style.display = 'block';
            }
        </script>
    </body>
    </html>
    `);
});

// Keep track of active connections to prevent premature closing
const connections = new Map();

// Pair Code Endpoint
app.post('/pair', async (req, res) => {
    let sock = null;
    let sessionId = null;
    let timeoutId = null;
    
    try {
        const { phone } = req.body;
        
        if (!phone) {
            return res.json({ success: false, message: 'Phone number required' });
        }
        
        console.log(`🔑 Generating pairing code for: ${phone}`);
        
        sessionId = 'LunaBot_' + Date.now() + '_' + Math.random().toString(36).substring(7);
        const sessionDir = path.join(__dirname, 'sessions', sessionId);
        
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }
        
        const { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        
        // Create socket with keep-alive settings
        sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            browser: ['LunaBot Mini', 'Chrome', '1.0.0'],
            logger: pino({ level: 'error' }),
            keepAliveIntervalMs: 30000, // Keep connection alive
            defaultQueryTimeoutMs: 60000 // Longer timeout
        });
        
        // Store connection
        connections.set(sessionId, { sock, phone, paired: false });
        
        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                console.log(`✅ User paired successfully: ${phone}`);
                
                const conn = connections.get(sessionId);
                if (conn && !conn.paired) {
                    conn.paired = true;
                    
                    try {
                        // Send session ID to user's DM
                        await sock.sendMessage(phone + '@s.whatsapp.net', {
                            text: `🔐 *LunaBot Mini - Session Generated*\n\nYour Session ID: \`${sessionId}\`\n\nSave this ID for deployment.\n\n⚠️ Keep this secret!`
                        });
                        console.log(`✅ Session ID sent to ${phone}`);
                        
                        // Keep connection alive a bit longer to ensure message is delivered
                        setTimeout(() => {
                            sock?.ws?.close();
                            connections.delete(sessionId);
                        }, 10000);
                    } catch (err) {
                        console.error('Failed to send session ID:', err);
                    }
                }
            }
            
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log(`Connection closed for ${phone} (${statusCode || 'unknown'})`);
                
                // Only delete if not paired yet (will retry)
                const conn = connections.get(sessionId);
                if (conn && !conn.paired) {
                    console.log(`Pairing not completed for ${phone}, will retry...`);
                } else {
                    connections.delete(sessionId);
                }
            }
        });
        
        // Save credentials
        sock.ev.on('creds.update', saveCreds);
        
        // Wait for socket to be ready
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Request pairing code with retry logic
        let code;
        let retries = 3;
        
        while (retries > 0) {
            try {
                code = await sock.requestPairingCode(phone);
                break;
            } catch (err) {
                retries--;
                console.log(`Retry ${3-retries}/3 for ${phone}`);
                if (retries === 0) throw err;
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        console.log(`✅ Pairing code for ${phone}: ${code}`);
        
        const formattedCode = code.match(/.{1,4}/g)?.join('-') || code;
        
        // Send response immediately
        res.json({
            success: true,
            code: formattedCode,
            message: 'Enter this code in WhatsApp'
        });
        
        // Keep connection alive for 3 minutes to allow pairing
        setTimeout(() => {
            const conn = connections.get(sessionId);
            if (conn && !conn.paired) {
                console.log(`Closing connection for ${phone} (no pairing detected after 3 minutes)`);
                sock?.ws?.close();
                connections.delete(sessionId);
            }
        }, 180000); // 3 minutes
        
    } catch (error) {
        console.error('❌ Pairing error:', error);
        
        // Clean up
        if (sock) {
            sock.ws?.close();
        }
        if (sessionId) {
            connections.delete(sessionId);
        }
        
        let errorMessage = 'Failed to generate code. ';
        if (error.message?.includes('rate')) {
            errorMessage = 'Too many requests. Please wait 10 minutes and try again.';
        } else if (error.message?.includes('invalid')) {
            errorMessage = 'Invalid phone number format.';
        } else {
            errorMessage = 'Service temporarily unavailable. Try again in a few minutes.';
        }
        
        return res.json({
            success: false,
            message: errorMessage
        });
    }
});

// QR Code Endpoint
app.post('/qr', async (req, res) => {
    let sock = null;
    let sessionId = null;
    
    try {
        const { phone } = req.body;
        
        if (!phone) {
            return res.json({ success: false, message: 'Phone number required' });
        }
        
        console.log(`📱 Generating QR code for: ${phone}`);
        
        sessionId = 'LunaBot_QR_' + Date.now() + '_' + Math.random().toString(36).substring(7);
        const sessionDir = path.join(__dirname, 'sessions', sessionId);
        
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }
        
        const { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        
        sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            browser: ['LunaBot Mini', 'Chrome', '1.0.0'],
            logger: pino({ level: 'error' }),
            keepAliveIntervalMs: 30000
        });
        
        connections.set(sessionId, { sock, phone, paired: false });
        
        let qrSent = false;
        
        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, qr, lastDisconnect } = update;
            
            if (qr && !qrSent) {
                qrSent = true;
                const qrImage = await QRCode.toDataURL(qr);
                
                // Send QR to client
                if (!res.headersSent) {
                    res.json({
                        success: true,
                        qr: qrImage,
                        message: 'Scan this QR code'
                    });
                }
            }
            
            if (connection === 'open') {
                console.log(`✅ QR user paired: ${phone}`);
                
                const conn = connections.get(sessionId);
                if (conn && !conn.paired) {
                    conn.paired = true;
                    
                    try {
                        await sock.sendMessage(phone + '@s.whatsapp.net', {
                            text: `🔐 *LunaBot Mini - Session Generated*\n\nYour Session ID: \`${sessionId}\`\n\nSave this ID for deployment.\n\n⚠️ Keep this secret!`
                        });
                        console.log(`✅ Session ID sent to ${phone}`);
                        
                        setTimeout(() => {
                            sock?.ws?.close();
                            connections.delete(sessionId);
                        }, 10000);
                    } catch (err) {
                        console.error('Failed to send session ID:', err);
                    }
                }
            }
            
            if (connection === 'close') {
                console.log(`QR connection closed for ${phone}`);
                connections.delete(sessionId);
            }
        });
        
        sock.ev.on('creds.update', saveCreds);
        
        // Set timeout for QR generation
        setTimeout(() => {
            if (!res.headersSent) {
                res.json({
                    success: false,
                    message: 'QR generation timeout. Please try again.'
                });
                sock?.ws?.close();
                connections.delete(sessionId);
            }
        }, 30000);
        
    } catch (error) {
        console.error('❌ QR error:', error);
        
        if (sock) {
            sock.ws?.close();
        }
        if (sessionId) {
            connections.delete(sessionId);
        }
        
        if (!res.headersSent) {
            return res.json({
                success: false,
                message: 'Failed to generate QR code.'
            });
        }
    }
});

app.listen(PORT, () => {
    console.log(`✅ LunaBot Server running on port ${PORT}`);
    console.log(`🌐 Open https://lunabot-mini.onrender.com`);
});
