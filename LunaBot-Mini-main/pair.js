// pair.js - FIXED VERSION with better WhatsApp connection
const express = require('express');
const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const { Boom } = require('@hapi/boom');

const app = express();
const PORT = process.env.PORT || 3000;

// Store active sessions temporarily
const activeSessions = new Map();

// Create sessions folder if it doesn't exist
if (!fs.existsSync('./sessions')) {
    fs.mkdirSync('./sessions');
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the pairing page
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>LunaBot Mini - Pairing</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {
                font-family: Arial, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
                margin: 0;
                padding: 20px;
            }
            .container {
                background: white;
                border-radius: 15px;
                padding: 40px;
                max-width: 400px;
                width: 100%;
                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            }
            h1 {
                text-align: center;
                color: #333;
                margin-bottom: 10px;
            }
            .subtitle {
                text-align: center;
                color: #666;
                margin-bottom: 30px;
                font-size: 14px;
            }
            .form-group {
                margin-bottom: 20px;
            }
            label {
                display: block;
                margin-bottom: 8px;
                color: #555;
                font-weight: bold;
            }
            input {
                width: 100%;
                padding: 12px;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                font-size: 16px;
                box-sizing: border-box;
            }
            input:focus {
                outline: none;
                border-color: #667eea;
            }
            button {
                width: 100%;
                padding: 14px;
                background: #667eea;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                transition: background 0.3s;
            }
            button:hover {
                background: #764ba2;
            }
            button:disabled {
                background: #ccc;
                cursor: not-allowed;
            }
            .info {
                background: #e3f2fd;
                border-left: 4px solid #2196f3;
                padding: 12px;
                margin: 20px 0;
                border-radius: 4px;
                font-size: 14px;
            }
            .info strong {
                color: #1976d2;
            }
            .result {
                margin-top: 20px;
                padding: 15px;
                border-radius: 8px;
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
            .result.warning {
                background: #fff3cd;
                border: 1px solid #ffeeba;
                color: #856404;
                display: block;
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
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
                margin: 0 auto 10px;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .pairing-code {
                background: #f8f9fa;
                border: 2px dashed #667eea;
                padding: 20px;
                font-size: 32px;
                font-family: monospace;
                text-align: center;
                letter-spacing: 5px;
                margin: 15px 0;
                border-radius: 8px;
                font-weight: bold;
            }
            .success-message {
                color: #28a745;
                font-weight: bold;
                margin-top: 15px;
            }
            .warning-message {
                color: #856404;
                font-weight: bold;
                margin-top: 15px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🌙 LunaBot Mini</h1>
            <div class="subtitle">Get your session ID in WhatsApp DM</div>
            
            <div class="info">
                <strong>📱 How it works:</strong><br>
                1. Enter your phone number<br>
                2. Get 8-digit code on THIS page<br>
                3. Open WhatsApp → Linked Devices<br>
                4. Enter the code<br>
                5. Session ID arrives in your DM!
            </div>
            
            <form id="pairForm" onsubmit="event.preventDefault(); generatePair();">
                <div class="form-group">
                    <label>Phone Number (with country code)</label>
                    <input type="tel" id="phone" placeholder="233594025845" required>
                    <small style="color: #666; display: block; margin-top: 5px;">Example: 233 for Ghana, 234 for Nigeria, 91 for India, 1 for USA</small>
                </div>
                
                <button type="submit" id="submitBtn">🔑 Generate Pair Code</button>
            </form>
            
            <div class="loading" id="loading">
                <div class="spinner"></div>
                <p>Connecting to WhatsApp...</p>
            </div>
            
            <div class="result" id="result"></div>
        </div>
        
        <script>
            async function generatePair() {
                const phone = document.getElementById('phone').value.trim();
                const submitBtn = document.getElementById('submitBtn');
                const loading = document.getElementById('loading');
                const result = document.getElementById('result');
                const pairForm = document.getElementById('pairForm');
                
                if (!phone) {
                    showResult('error', 'Please enter your phone number');
                    return;
                }
                
                if (!/^\\d+$/.test(phone)) {
                    showResult('error', 'Only numbers allowed (no spaces, no +)');
                    return;
                }
                
                if (phone.length < 10 || phone.length > 15) {
                    showResult('error', 'Phone number should be 10-15 digits');
                    return;
                }
                
                submitBtn.disabled = true;
                loading.style.display = 'block';
                result.style.display = 'none';
                
                try {
                    const response = await fetch('/pair', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phone: phone })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        result.className = 'result success';
                        result.innerHTML = 
                            '<strong>✅ Your Pairing Code:</strong><br>' +
                            '<div class="pairing-code">' + data.code + '</div>' +
                            '<p>📱 Open <strong>WhatsApp → Linked Devices → Link a Device</strong></p>' +
                            '<p>Enter the code above</p>' +
                            '<p class="success-message">⏳ After pairing, session ID will be sent to your DM!</p>';
                        
                        // Hide the form
                        pairForm.style.display = 'none';
                    } else {
                        if (data.type === 'timeout') {
                            showResult('warning', '⚠️ ' + data.message);
                        } else {
                            showResult('error', '❌ ' + data.message);
                        }
                        submitBtn.disabled = false;
                    }
                } catch (error) {
                    showResult('error', 'Server error. Please try again.');
                    console.error('Error:', error);
                    submitBtn.disabled = false;
                } finally {
                    loading.style.display = 'none';
                }
            }
            
            function showResult(type, message) {
                const result = document.getElementById('result');
                result.className = 'result ' + type;
                result.innerHTML = message;
                result.style.display = 'block';
            }
        </script>
    </body>
    </html>
    `);
});

// API endpoint for REAL WhatsApp pairing
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
        
        // Generate a unique session ID
        sessionId = 'LunaBot_' + Date.now() + '_' + Math.random().toString(36).substring(7);
        
        // Create session folder
        const sessionDir = path.join(__dirname, 'sessions', sessionId);
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }
        
        // Get latest version
        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`Using Baileys version: ${version}`);
        
        // Setup Baileys with keep-alive
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        
        sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            browser: ['LunaBot Mini', 'Chrome', '1.0.0'],
            logger: pino({ level: 'error' }),
            generateHighQualityLinkPreview: false,
            syncFullHistory: false,
            defaultQueryTimeoutMs: 60000, // Increase timeout
            keepAliveIntervalMs: 30000 // Keep connection alive
        });
        
        // Store session info
        activeSessions.set(sessionId, {
            sock,
            phone,
            sessionDir,
            paired: false,
            res: res // Store response object to send later if needed
        });
        
        // Listen for connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                console.log(`✅ User paired successfully: ${phone}`);
                
                const session = activeSessions.get(sessionId);
                if (session && !session.paired) {
                    session.paired = true;
                    
                    try {
                        // Send session ID to user's DM
                        await sock.sendMessage(phone + '@s.whatsapp.net', {
                            text: `🔐 *LunaBot Mini - Session Generated*\n\nYour Session ID: \`${sessionId}\`\n\nSave this ID for deployment.\n\n⚠️ Keep this secret!`
                        });
                        console.log(`✅ Session ID sent to ${phone}`);
                    } catch (err) {
                        console.error('Failed to send session ID:', err);
                    }
                    
                    // Clean up after 10 seconds
                    setTimeout(() => {
                        sock?.ws?.close();
                        activeSessions.delete(sessionId);
                    }, 10000);
                }
            }
            
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const isLoggedOut = statusCode === 401;
                
                if (isLoggedOut) {
                    console.log(`Connection closed - logged out for ${phone}`);
                } else {
                    console.log(`Connection closed for ${phone} (reconnecting...)`);
                    // Try to reconnect
                    // activeSessions.delete(sessionId);
                }
            }
        });
        
        // Save credentials
        sock.ev.on('creds.update', saveCreds);
        
        // Wait for socket to be ready
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Set a timeout for the pairing request
        const pairingPromise = sock.requestPairingCode(phone);
        
        // Race between pairing and timeout
        const code = await Promise.race([
            pairingPromise,
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('TIMEOUT')), 30000)
            )
        ]);
        
        console.log(`✅ Pairing code for ${phone}: ${code}`);
        
        // Format code with dash
        const formattedCode = code.match(/.{1,4}/g)?.join('-') || code;
        
        // Send code back to webpage immediately
        return res.json({
            success: true,
            code: formattedCode,
            message: 'Enter this code in WhatsApp'
        });
        
    } catch (error) {
        console.error('❌ Pairing error:', error);
        
        // Clean up
        if (sock) {
            sock.ws?.close();
        }
        if (sessionId) {
            activeSessions.delete(sessionId);
        }
        
        let errorMessage = 'Failed to generate code. ';
        let errorType = 'error';
        
        if (error.message === 'TIMEOUT') {
            errorMessage = 'Connection timeout. WhatsApp might be blocking this request. Try again in 10-15 minutes.';
            errorType = 'timeout';
        } else if (error.message?.includes('rate')) {
            errorMessage = 'Too many requests. Please wait 15 minutes and try again.';
            errorType = 'timeout';
        } else if (error.message?.includes('invalid')) {
            errorMessage = 'Invalid phone number format. Use country code without + or spaces.';
        } else if (error.message?.includes('block')) {
            errorMessage = 'WhatsApp has temporarily blocked pairing from this server. Try again in 30 minutes.';
            errorType = 'timeout';
        } else {
            errorMessage = 'Service temporarily unavailable. Try again in a few minutes.';
        }
        
        return res.json({
            success: false,
            type: errorType,
            message: errorMessage
        });
    }
});

app.listen(PORT, () => {
    console.log(`✅ LunaBot Pairing Server running on port ${PORT}`);
    console.log(`🌐 Open https://lunabot-mini.onrender.com in browser`);
});
