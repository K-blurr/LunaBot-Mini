// pair.js - Add this to your LunaBot-Mini folder
const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

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

// API endpoint for pairing
app.post('/pair', async (req, res) => {
    try {
        const { phone } = req.body;
        
        if (!phone) {
            return res.json({ success: false, message: 'Phone number required' });
        }
        
        // Generate a random 8-digit code
        const pairCode = Math.floor(10000000 + Math.random() * 90000000);
        
        // Format the code with dash
        const formattedCode = pairCode.toString().match(/.{1,4}/g).join('-');
        
        // Here you would normally send this to your bot
        // For now, we'll just return it
        console.log(`Pairing code for ${phone}: ${formattedCode}`);
        
        res.json({
            success: true,
            code: formattedCode,
            message: 'Code generated successfully'
        });
        
    } catch (error) {
        res.json({ success: false, message: 'Server error' });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Pairing server running on port ${PORT}`);
    console.log(`🌐 Open https://your-render-link.onrender.com in browser`);
});
