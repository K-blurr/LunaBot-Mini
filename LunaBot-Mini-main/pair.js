// pair.js - Complete working version with REAL WhatsApp pairing
const express = require('express');
const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

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
                padding: 15px;
                font-size: 24px;
                font-family: monospace;
                text-align: center;
                letter-spacing: 5px;
                margin: 15px 0;
                border-radius: 8px;
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
                2. Get 8-digit code<br>
                3. Open WhatsApp → Linked Devices<br>
                4. Enter code<br>
                5. Session ID arrives in your DM!
            </div>
            
            <form id="pairForm" onsubmit="event.preventDefault(); generatePair();">
                <div class="form-group">
                    <label>Phone Number (with country code)</label>
                    <input type="tel" id="phone" placeholder="2348012345678" required>
                    <small style="color: #666; display: block; margin-top: 5px;">Example: 234 for Nigeria, 91 for India, 1 for USA</small>
                </div>
                
                <button type="submit" id="submitBtn">🔑 Generate Pair Code</button>
            </form>
            
            <div class="loading" id="loading">
                <div class="spinner"></div>
                <p>Processing... Check your WhatsApp</p>
            </div>
            
            <div class="result" id="result"></div>
        </div>
        
        <script>
            async function generatePair() {
                const phone = document.getElementById('phone').value.trim();
                const submitBtn = document.getElementById('submitBtn');
                const loading = document.getElementById('loading');
                const result = document.getElementById('result');
                
                if (!phone) {
                    showResult('error', 'Please enter your phone number');
                    return;
                }
                
                if (!/^\\d+$/.test(phone)) {
                    showResult('error', 'Only numbers allowed');
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
                        result.innerHTML = \`
                            <strong>✅ Code Generated!</strong><br>
                            <div class="pairing-code">\${data.code}</div>
                            <p>📱 Open WhatsApp → Linked Devices → Link a Device</p>
                            <p>Enter the code above</p>
                            <p style="margin-top: 10px;">After pairing, session ID will be sent to your DM!</p>
                        \`;
                    } else {
                        showResult('error', data.message || 'Failed to generate code');
                    }
                } catch (error) {
                    showResult('error', 'Server error. Please try again.');
                } finally {
                    submitBtn.disabled = false;
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
    try {
        const { phone } = req.body;
        
        if (!phone) {
            return res.json({ success: false, message: 'Phone number required' });
        }
        
        console.log(`🔑 Generating pairing code for: ${phone}`);
        
        // Generate a unique session ID
        const sessionId = 'LunaBot_' + Date.now() + '_' + Math.random().toString(36).substring(7);
        
        // Create session folder
        const sessionDir = path.join(__dirname, 'sessions', sessionId);
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }
        
        // Setup Baileys
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            browser: ['LunaBot Mini', 'Chrome', '1.0.0'],
            logger: pino({ level: 'silent' })
        });
        
        // Listen for connection
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                console.log(`✅ Connected for: ${phone}`);
                
                // Send session ID to user
                await sock.sendMessage(phone + '@s.whatsapp.net', {
                    text: `🔐 *LunaBot Mini - Session Generated*\n\nYour Session ID: \`${sessionId}\`\n\nSave this ID for deployment.\n\nAdd this to your Render environment variables:\n\`SESSION_ID=${sessionId}\`\n\n⚠️ Keep this secret!`
                });
                
                // Close connection after 3 seconds
                setTimeout(() => {
                    sock.ws.close();
                }, 3000);
            }
        });
        
        // Save credentials
        sock.ev.on('creds.update', saveCreds);
        
        // Request REAL pairing code
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(phone);
                console.log(`✅ Real pairing code for ${phone}: ${code}`);
                
                // Format code (add dash in middle)
                const formattedCode = code.match(/.{1,4}/g)?.join('-') || code;
                
                // Send response to web
                res.json({
                    success: true,
                    code: formattedCode,
                    message: 'Check WhatsApp for the code'
                });
                
            } catch (error) {
                console.error('❌ Pairing error:', error);
                res.json({
                    success: false,
                    message: 'Failed to generate code. Check number and try again.'
                });
            }
        }, 2000);
        
    } catch (error) {
        console.error('❌ Server error:', error);
        res.json({ success: false, message: 'Server error' });
    }
});

app.listen(PORT, () => {
    console.log(`✅ LunaBot Pairing Server running on port ${PORT}`);
    console.log(`🌐 Open https://lunabot-mini.onrender.com in browser`);
});
