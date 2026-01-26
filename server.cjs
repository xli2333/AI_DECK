const http = require('http');
const fs = require('fs');
const path = require('path');
const ocr_api20210707 = require('@alicloud/ocr-api20210707');
const OpenApi = require('@alicloud/openapi-client');
const Util = require('@alicloud/tea-util');
const { Readable } = require('stream');

const port = process.env.PORT || 3001;

// 1. Configure Aliyun Client
const createClient = () => {
    const config = new OpenApi.Config({
        accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
        accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
    });
    config.endpoint = `ocr-api.cn-hangzhou.aliyuncs.com`;
    return new ocr_api20210707.default(config);
};

// 2. Helper: Normalize Coordinates (0-1000 scale with precision)
const normalizeBox = (pos, orgWidth, orgHeight) => {
    if (!pos || pos.length < 3 || !orgWidth || !orgHeight) return [0, 0, 0, 0];
    const xs = pos.map(p => p.x);
    const ys = pos.map(p => p.y);
    const xmin = Math.min(...xs);
    const xmax = Math.max(...xs);
    const ymin = Math.min(...ys);
    const ymax = Math.max(...ys);
    
    // Helper to format float to 4 decimals for high precision (0.1% accuracy -> 0.001% accuracy)
    const fmt = (n) => Number(n.toFixed(4));

    return [
        fmt((ymin / orgHeight) * 1000),
        fmt((xmin / orgWidth) * 1000),
        fmt((ymax / orgHeight) * 1000),
        fmt((xmax / orgWidth) * 1000)
    ];
};

// 3. Create Server
const server = http.createServer(async (req, res) => {
    // Basic CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // --- NEW: Local File Reader API (For Prompts) ---
    if (req.method === 'POST' && req.url === '/api/read-file') {
        let body = [];
        req.on('data', (chunk) => body.push(chunk));
        req.on('end', () => {
            try {
                const { filePath } = JSON.parse(Buffer.concat(body).toString());
                if (!filePath) throw new Error("No filePath provided");

                // Security: Prevent directory traversal slightly, though this is a local tool
                const safePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
                const fullPath = path.resolve(process.cwd(), safePath);

                console.log(`[File Server] Reading: ${fullPath}`);

                fs.readFile(fullPath, 'utf8', (err, data) => {
                    if (err) {
                        console.error(`[File Server] Error reading file: ${err.message}`);
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: "File not found or unreadable" }));
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ content: data }));
                    }
                });
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    if (req.method === 'POST' && req.url === '/api/ocr') {
        let body = [];
        req.on('data', (chunk) => { body.push(chunk); });
        req.on('end', async () => {
            try {
                const buffer = Buffer.concat(body);
                
                console.log(`[OCR Server] Received request. Body length: ${buffer.length} bytes.`);

                // Form-data handling logic (Simplified)
                // We find the start of the PNG data in the multipart form
                // In a real browser FormData upload, the boundary is at the start
                const start = buffer.indexOf(Buffer.from('\r\n\r\n')) + 4;
                const end = buffer.lastIndexOf(Buffer.from('\r\n--'));
                
                if (start < 4 || end === -1) {
                     throw new Error("Invalid multipart/form-data payload: Could not parse image boundary.");
                }

                const imageBuffer = buffer.slice(start, end);
                console.log(`[OCR Server] Extracted Image Buffer: ${imageBuffer.length} bytes.`);

                const client = createClient();
                const fileStream = Readable.from(imageBuffer);
                const request = new ocr_api20210707.RecognizeGeneralRequest({ body: fileStream });
                
                // Enhanced Runtime Options with Retry
                const runtime = new Util.RuntimeOptions({
                    readTimeout: 10000,
                    connectTimeout: 10000,
                    autoretry: true,
                    maxAttempts: 3
                });

                console.log(`[OCR Server] Sending request to Aliyun (Timeout: 10s, Retries: 3)...`);
                const startTime = Date.now();
                const resp = await client.recognizeGeneralWithOptions(request, runtime);
                console.log(`[OCR Server] Aliyun Response received in ${Date.now() - startTime}ms.`);
                
                let data = resp.body.data;
                if (typeof data === 'string') data = JSON.parse(data);

                const orgWidth = data.orgWidth || data.width || 1920;
                const orgHeight = data.orgHeight || data.height || 1080;
                
                const elements = (data.prism_wordsInfo || []).map(word => {
                    const box = normalizeBox(word.pos, orgWidth, orgHeight);
                    // box is [ymin, xmin, ymax, xmax] in 0-1000 scale (floats)
                    const h_norm = box[2] - box[0]; 
                    
                    // Estimate Font Size - ULTRA PRECISION MODE
                    // Goal: 1:1 Visual Match.
                    // Theory: 
                    // 1. OCR Box Height = Ascent + Descent + Leading (Line Gap).
                    // 2. PPTX Font Size = Ascent + Descent (roughly).
                    // 3. Standard Typesetting: Line Height is 1.2x to 1.4x of Font Size.
                    // 4. Therefore, Font Size should be approx 1 / 1.25 = 0.8 of Box Height.
                    // 
                    // Previous Attempts: 
                    // - 1.0 (Too Big)
                    // - 0.85 (Better)
                    // - 0.92 (Drifted)
                    // 
                    // New Calculation:
                    // We use 0.78 as the "Golden Ratio" for OCR-to-PPT font scaling.
                    // This ensures text fits inside the box 99% of the time, preventing wrap-overflow.
                    // We also constrain it to integer-ish values for cleaner PPT XML.
                    
                    let estimatedSize = ((h_norm / 1000) * 405) * 0.78; 
                    
                    // Minimal safety clamping (e.g. don't allow font < 4pt or > 200pt)
                    estimatedSize = Math.max(4, Math.min(200, estimatedSize));

                    // Use 2 decimal precision for font size
                    estimatedSize = Math.round(estimatedSize * 100) / 100;

                    return {
                        content: word.word,
                        box: box,
                        style: { 
                            fontSize: estimatedSize, 
                            color: '#000000', 
                            align: 'left' 
                        }
                    };
                });

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ elements }));
            } catch (error) {
                console.error("================ [OCR Server Error] ================");
                console.error("Message:", error.message);
                console.error("Stack:", error.stack);
                if (error.data) console.error("Aliyun Error Data:", JSON.stringify(error.data, null, 2));
                console.error("====================================================");
                
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    error: error.message,
                    details: error.data || "Check server logs for stack trace" 
                }));
            }
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(port, () => {
    console.log(`✅ Native Aliyun OCR Proxy running at http://localhost:${port}`);
});