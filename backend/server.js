const express = require('express');
const multer = require('multer');
const axios = require('axios');
const sharp = require('sharp');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const { createCanvas } = require('canvas');
require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini with the API key from environment variables
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG images and PDF files are allowed.'));
        }
    }
});

// Wrapper middleware to handle multer errors
const uploadMiddleware = (req, res, next) => {
    const uploadSingle = upload.single('document');
    uploadSingle(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            console.error('Multer error:', err);
            return res.status(400).json({ error: `File upload error: ${err.message}` });
        } else if (err) {
            console.error('Unknown upload error:', err);
            return res.status(400).json({ error: err.message });
        }
        next();
    });
};

// Disable worker for Node.js environment
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

// Helper function to convert PDF to image
async function pdfToImage(pdfBuffer) {
    console.log('Starting PDF to image conversion...');
    try {
        const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(pdfBuffer),
            disableFontFace: true,
            disableRange: true,
            verbosity: 0
        });
        const pdfDocument = await loadingTask.promise;
        const page = await pdfDocument.getPage(1);
        const scale = 2.0;
        const viewport = page.getViewport({ scale });
        const canvas = createCanvas(viewport.width, viewport.height);
        const context = canvas.getContext('2d');
        const renderContext = { canvasContext: context, viewport: viewport };
        await page.render(renderContext).promise;
        return canvas.toBuffer('image/jpeg', { quality: 0.95 });
    } catch (error) {
        console.error('PDF to image conversion error:', error);
        throw new Error(`Failed to convert PDF to image: ${error.message}`);
    }
}

// Utility for delays (handling 429 rate limits)
const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Single call: verifies document type AND extracts data simultaneously
async function extractWithGemini(imageBuffer, mimeType, expectedDocType) {
    const base64Image = imageBuffer.toString('base64');

    const promptText = `You are a highly capable AI specialized in Indian academic document data extraction.

STEP 1 - STRICT VERIFICATION: Verify if this image is EXACTLY a "${expectedDocType || 'SSC or HSC Marksheet'}".
- If the expected type is "SSC Marksheet", the image MUST be a 10th grade marksheet. If the image is a 12th grade/HSC marksheet, you MUST reject it by setting "notAMarksheet": true.
- If the expected type is "HSC Marksheet", the image MUST be a 12th grade marksheet. If the image is a 10th grade/SSC marksheet, you MUST reject it by setting "notAMarksheet": true.
- If the image is a photo, ID card, blank page, or any other non-academic document, set "notAMarksheet": true.

STEP 2 - EXTRACT: If the document strictly matches the expected type, extract the fields below.

Return ONLY a valid JSON object with this exact structure. No markdown, no explanation:
{
  "notAMarksheet": false,
  "invalidReason": "",
  "personalInfo": {
    "firstName": "",
    "middleName": "",
    "lastName": "",
    "mothersName": "",
    "gender": "",
    "dob": "",
    "seatNo": "",
    "candidateName": "",
    "abcId": ""
  },
  "academicInfo": {
    "board": "",
    "schoolName": "",
    "examination": "",
    "passingYear": "",
    "passingMonth": "",
    "marksObtained": "",
    "marksOutof": "",
    "percentage": "",
    "cgpa": "",
    "grade": "",
    "result": "",
    "stream": "",
    "subjects": []
  }
}

Rules:
- notAMarksheet: set true ONLY if the document does NOT match the requested "${expectedDocType || 'SSC or HSC Marksheet'}" (e.g. uploading HSC when SSC is requested).
- invalidReason: short explanation if notAMarksheet is true (e.g., "This is an HSC marksheet, but an SSC marksheet was requested"), otherwise empty string
- examination: 'HSC' or 'SSC'
- result: 'PASS' or 'FAIL'
- passingYear: YYYY format (e.g., 2021)
- percentage: number only (e.g., 85.50)
- seatNo: alphanumeric seat/roll number
- candidateName: full name exactly as printed on document
- mothersName: mother's name exactly as printed
- abcId: ABC ID or APAAR ID if visible on the marksheet
- IMPORTANT - Indian name format is SURNAME FIRSTNAME MIDDLENAME:
  - lastName = first word, firstName = second word, middleName = remaining words
  - If 2 words: lastName = first, firstName = second, middleName = ''
- Do not leave firstName/middleName/lastName empty if candidateName is filled`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const imagePart = { inlineData: { data: base64Image, mimeType: mimeType } };

    const MAX_RETRIES = 3;
    let lastErr;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const result = await model.generateContent([promptText, imagePart]);
            let content = result.response.text() || "";
            console.log("---- Raw Gemini Response ----");
            console.log(content);
            console.log("-----------------------------");

            if (content.includes('\`\`\`json')) content = content.split('\`\`\`json')[1].split('\`\`\`')[0].trim();
            else if (content.includes('\`\`\`')) content = content.split('\`\`\`')[1].split('\`\`\`')[0].trim();

            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) content = jsonMatch[0];

            const parsed = JSON.parse(content);

            const fullName = (parsed.personalInfo?.candidateName || '').trim();
            if (fullName && !parsed.personalInfo.firstName) {
                const parts = fullName.split(/\s+/);
                if (parts.length >= 3) {
                    parsed.personalInfo.lastName = parts[0];
                    parsed.personalInfo.firstName = parts[1];
                    parsed.personalInfo.middleName = parts.slice(2).join(' ');
                } else if (parts.length === 2) {
                    parsed.personalInfo.lastName = parts[0];
                    parsed.personalInfo.firstName = parts[1];
                    parsed.personalInfo.middleName = '';
                } else {
                    parsed.personalInfo.firstName = fullName;
                }
            }
            return parsed;
        } catch (err) {
            lastErr = err;
            const retryMatch = (err.message || '').match(/"retryDelay":"(\d+)s"/);
            if (retryMatch && attempt < MAX_RETRIES) {
                const waitSec = parseInt(retryMatch[1], 10) + 2;
                console.warn(`Gemini rate-limited. Waiting ${waitSec}s before retry (attempt ${attempt}/${MAX_RETRIES})...`);
                await sleepMs(waitSec * 1000);
            } else {
                break;
            }
        }
    }

    console.error("Gemini extraction error:", lastErr.message || lastErr);
    throw new Error(`Failed to extract via Gemini API. Reason: ${lastErr.message || 'Unknown error'}`);
}

// Endpoint: Extract + Verify data from SSC/HSC marksheet using Gemini
app.post('/api/extract-marksheet', uploadMiddleware, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const expectedDocType = req.body.expectedDocType || req.body.document_name || 'SSC or HSC Marksheet';
        console.log(`Processing marksheet extraction with Gemini (expected: ${expectedDocType})...`);

        let imageBuffer = req.file.buffer;
        let mimeType = req.file.mimetype;

        if (mimeType === 'application/pdf') {
            console.log("Converting PDF to JPEG...");
            imageBuffer = await pdfToImage(req.file.buffer);
            mimeType = 'image/jpeg';
        }

        console.log("Optimizing image for AI inference...");
        const optimizedImageBuffer = await sharp(imageBuffer)
            .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer();

        console.log("Sending image to Gemini (verify + extract in one call)...");
        const extractedData = await extractWithGemini(optimizedImageBuffer, 'image/jpeg', expectedDocType);

        if (extractedData.notAMarksheet) {
            console.warn('Gemini identified document as invalid:', extractedData.invalidReason);
            return res.status(400).json({
                error: `Invalid document: ${extractedData.invalidReason || 'This does not appear to be a valid SSC or HSC Marksheet. Please upload the correct document.'}`
            });
        }

        delete extractedData.notAMarksheet;
        delete extractedData.invalidReason;

        console.log('Extraction successful:', JSON.stringify(extractedData, null, 2));
        res.json({
            success: true,
            data: extractedData
        });

    } catch (error) {
        console.error('Extraction error:', error);
        res.status(500).json({
            error: error.message || 'Failed to extract data from marksheet'
        });
    }
});

// Endpoint: Verify document type (Now mocked because it's combined into extract-marksheet)
app.post('/api/verify-document', uploadMiddleware, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const expectedType = req.body.expectedType || 'HSC Marksheet';
        console.log('Verifying document (instant accept)...');

        // Return instant success because actual verification is now done during extraction
        res.json({
            success: true,
            verification: {
                isValid: true,
                confidence: 99,
                documentType: expectedType,
                reason: "Document verification combined with extraction"
            }
        });
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({
            error: error.message || 'Failed to verify document'
        });
    }
});

// Endpoint: Validate passport photo (Mocked for speed if needed)
app.post('/api/validate-photo', uploadMiddleware, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        res.json({
            success: true,
            validation: {
                isValid: true,
                errors: []
            }
        });
    } catch (error) {
        console.error('Validation error:', error);
        res.status(500).json({
            error: error.message || 'Failed to validate photo'
        });
    }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
    res.json({ status: 'healthy', api: 'Gemini 2.5 Active' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled specific error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        details: err.message
    });
});

// Helper to save file to disk
async function saveFileToDisk(buffer, originalName) {
    const uploadDir = path.join(__dirname, 'uploads');
    try {
        await fs.mkdir(uploadDir, { recursive: true });
        const timestamp = Date.now();
        const safeName = originalName.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
        const filename = `${timestamp}_${safeName}`;
        const filepath = path.join(uploadDir, filename);

        await fs.writeFile(filepath, buffer);
        console.log(`File saved to ${filepath}`);
        return filename;
    } catch (error) {
        console.error('Error saving file:', error);
        throw new Error('Failed to save file to disk');
    }
}

// Endpoint: Upload PDF (matches Admission/uploadPdf)
app.post('/api/Admission/uploadPdf', uploadMiddleware, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        console.log('Uploading PDF:', req.file.originalname);
        const filename = await saveFileToDisk(req.file.buffer, req.file.originalname);

        res.json({
            status: 1,
            message: 'File uploaded successfully',
            dataJson: { fileName: filename }
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: Upload Doc Image (matches Admission/uploadDocImage)
app.post('/api/Admission/uploadDocImage', uploadMiddleware, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        console.log('Uploading Doc Image:', req.file.originalname);
        const filename = await saveFileToDisk(req.file.buffer, req.file.originalname);

        res.json({
            status: 1,
            message: 'Image uploaded successfully',
            dataJson: { fileName: filename }
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Start server
app.listen(PORT, async () => {
    console.log(`🚀 Document extraction backend running on port ${PORT}`);
    console.log('📡 Configured for Gemini AI (gemini-2.5-flash)');
    console.log('🔍 Endpoints: ');
    console.log('   POST /api/extract-marksheet');
    console.log('   POST /api/verify-document (mocked)');
    console.log('   POST /api/validate-photo (mocked)');
    console.log('   POST /api/Admission/uploadPdf');
    console.log('   POST /api/Admission/uploadDocImage');
    console.log('   GET  /api/health');
});
