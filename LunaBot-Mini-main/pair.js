// pair.js - FINAL STABLE VERSION
const express = require('express');
const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

// Store active connections
const connections = new Map();

// Create sessions folder
if (!fs.existsSync('./sessions')) {
    fs.mkdirSync('./sessions');
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple homepage
app.get('/', (req, res) => {
    res.send('LunaBot Mini Pairing Server Running ✅');
});


// ==============================
// 🔐 PAIR CODE ENDPOINT (FIXED)
// ==============================
app.post('/pair', async (req, res) => {
    let sock = null;
    let sessionId = null;

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

        sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            browser: ['LunaBot Mini', 'Chrome', '1.0.0'],
            logger: pino({ level: 'error' }),
            keepAliveIntervalMs: 30000,
            defaultQueryTimeoutMs: 60000
        });

        connections.set(sessionId, { sock, phone, paired: false });

        sock.ev.on('creds.update', saveCreds);

        // ✅ WAIT FOR REAL CONNECTION READY
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("Connection timeout"));
            }, 20000);

            sock.ev.on('connection.update', (update) => {
                const { connection } = update;

                if (connection === 'connecting') {
                    console.log('Connecting to WhatsApp...');
                }

                if (connection === 'open') {
                    clearTimeout(timeout);
                    console.log('Socket connected.');
                    resolve();
                }

                if (connection === 'close') {
                    clearTimeout(timeout);
                    reject(new Error("Connection closed before pairing"));
                }
            });
        });

        // ✅ REQUEST PAIRING CODE
        const code = await sock.requestPairingCode(phone);

        console.log(`✅ Pairing code generated: ${code}`);

        const formattedCode = code.match(/.{1,4}/g)?.join('-') || code;

        res.json({
            success: true,
            code: formattedCode
        });

        // Handle successful pairing
        sock.ev.on('connection.update', async (update) => {
            const { connection } = update;

            if (connection === 'open') {
                const conn = connections.get(sessionId);

                if (conn && !conn.paired) {
                    conn.paired = true;

                    try {
                        await sock.sendMessage(phone + '@s.whatsapp.net', {
                            text: `🔐 *LunaBot Mini - Session Generated*\n\nYour Session ID:\n\`${sessionId}\`\n\nSave this ID for deployment.\n\n⚠️ Keep this secret!`
                        });

                        console.log(`✅ Session ID sent to ${phone}`);

                        setTimeout(() => {
                            sock?.ws?.close();
                            connections.delete(sessionId);
                        }, 10000);

                    } catch (err) {
                        console.error("Failed to send session ID:", err);
                    }
                }
            }
        });

        // 3-minute timeout
        setTimeout(() => {
            const conn = connections.get(sessionId);
            if (conn && !conn.paired) {
                console.log(`⏳ Closing inactive pairing for ${phone}`);
                sock?.ws?.close();
                connections.delete(sessionId);
            }
        }, 180000);

    } catch (error) {
        console.error('❌ Pairing error:', error);

        if (sock) sock.ws?.close();
        if (sessionId) connections.delete(sessionId);

        return res.json({
            success: false,
            message: 'Failed to generate pairing code. Try again.'
        });
    }
});


// ==============================
// 📱 QR CODE ENDPOINT
// ==============================
app.post('/qr', async (req, res) => {
    let sock = null;
    let sessionId = null;

    try {
        const { phone } = req.body;

        if (!phone) {
            return res.json({ success: false, message: 'Phone number required' });
        }

        console.log(`📱 Generating QR for: ${phone}`);

        sessionId = 'LunaBot_QR_' + Date.now();
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
            logger: pino({ level: 'error' }),
            browser: ['LunaBot Mini', 'Chrome', '1.0.0']
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { qr, connection } = update;

            if (qr) {
                const qrImage = await QRCode.toDataURL(qr);

                if (!res.headersSent) {
                    res.json({
                        success: true,
                        qr: qrImage
                    });
                }
            }

            if (connection === 'close') {
                sock?.ws?.close();
            }
        });

        setTimeout(() => {
            if (!res.headersSent) {
                res.json({
                    success: false,
                    message: 'QR generation timeout.'
                });
                sock?.ws?.close();
            }
        }, 30000);

    } catch (error) {
        console.error('❌ QR error:', error);

        if (sock) sock.ws?.close();

        if (!res.headersSent) {
            return res.json({
                success: false,
                message: 'Failed to generate QR.'
            });
        }
    }
});

app.listen(PORT, () => {
    console.log(`✅ LunaBot Pair Server running on port ${PORT}`);
});
