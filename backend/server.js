const express = require('express');
const multer = require('multer');
const axios = require('axios');
const sharp = require('sharp');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const { createCanvas } = require('canvas');

const app = express();
const PORT = process.env.PORT || 3000;

// Default to 11434, but will probe to find the active one
let OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';

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
            // A Multer error occurred when uploading.
            console.error('Multer error:', err);
            return res.status(400).json({ error: `File upload error: ${err.message}` });
        } else if (err) {
            // An unknown error occurred when uploading.
            console.error('Unknown upload error:', err);
            return res.status(400).json({ error: err.message });
        }
        // Everything went fine.
        next();
    });
};

// Disable worker for Node.js environment
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

// Helper function to convert PDF to image
async function pdfToImage(pdfBuffer) {
    console.log('Starting PDF to image conversion...');
    try {
        // Load the PDF document
        console.log('Loading PDF document...');
        const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(pdfBuffer),
            disableFontFace: true,
            disableRange: true,
            verbosity: 0
        });
        const pdfDocument = await loadingTask.promise;
        console.log(`PDF loaded. Pages: ${pdfDocument.numPages}`);

        // Get the first page
        console.log('Getting first page...');
        const page = await pdfDocument.getPage(1);

        // Set scale for better quality
        const scale = 2.0;
        const viewport = page.getViewport({ scale });
        console.log(`Page details: ${viewport.width}x${viewport.height}`);

        // Create canvas
        console.log('Creating canvas...');
        const canvas = createCanvas(viewport.width, viewport.height);
        const context = canvas.getContext('2d');

        // Render PDF page to canvas
        console.log('Rendering page to canvas...');
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };

        await page.render(renderContext).promise;
        console.log('Page rendered successfully');

        // Convert canvas to buffer
        return canvas.toBuffer('image/jpeg', { quality: 0.95 });
    } catch (error) {
        console.error('PDF to image conversion error:', error);
        // Log stack trace if available
        if (error.stack) console.error(error.stack);
        throw new Error(`Failed to convert PDF to image: ${error.message}`);
    }
}

// Helper function to convert document (image or PDF) to base64
async function documentToBase64(buffer, mimetype) {
    try {
        let imageBuffer = buffer;

        // If it's a PDF, convert to image first
        if (mimetype === 'application/pdf') {
            console.log('Converting PDF to image...');
            imageBuffer = await pdfToImage(buffer);
        }

        // Resize and optimize image
        const processedImage = await sharp(imageBuffer)
            .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer();

        return processedImage.toString('base64');
    } catch (error) {
        console.error('Document processing error:', error);
        throw new Error('Failed to process document');
    }
}

// Helper function to call Ollama API
async function callOllamaVision(base64Image, prompt) {
    console.log(`Sending request to Ollama at ${OLLAMA_URL}...`);
    try {
        const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
            model: 'kimi-k2.5:cloud',
            prompt: prompt,
            images: [base64Image],
            stream: false
        });

        return response.data.response;
    } catch (error) {
        console.error('Ollama API error:', error.message);
        if (error.code === 'ECONNREFUSED') {
            throw new Error(`Failed to connect to Ollama at ${OLLAMA_URL}. Is it running?`);
        }
        throw new Error('Failed to communicate with Ollama');
    }
}

// Endpoint: Extract data from HSC marksheet
app.post('/api/extract-marksheet', uploadMiddleware, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        console.log('Processing marksheet extraction...');

        // Convert document (image or PDF) to base64
        const base64Image = await documentToBase64(req.file.buffer, req.file.mimetype);

        // Create detailed prompt for extraction
        const extractionPrompt = `You are an AI specialized in data extraction from documents. Analyze this mark sheet image (which could be HSC/12th Grade OR SSC/10th Grade) and extract the following information in strict JSON format.

{
  "personalInfo": {
    "firstName": "student's first name",
    "middleName": "student's middle name",
    "lastName": "student's last name",
    "mothersName": "mother's name",
    "gender": "Male or Female",
    "dob": "Date of Birth in DD/MM/YYYY format",
    "seatNo": "Seat Number or Roll Number (e.g. B123456, A012345)",
    "candidateName": "Full Candidate Name as it appears on the marksheet"
  },
  "academicInfo": {
    "board": "Name of Board / University (e.g., Maharashtra State Board)",
    "schoolName": "Name of School / College / Institute",
    "examination": "Identify if it is 'HSC' (12th) or 'SSC' (10th) based on the text",
    "passingYear": "Year of Passing (YYYY)",
    "passingMonth": "Month of Passing (e.g., March, June)",
    "marksObtained": "Total Marks Obtained (number)",
    "marksOutof": "Total Maximum Marks (number)",
    "percentage": "Percentage (number)",
    "cgpa": "CGPA (number, if applicable)",
    "grade": "Grade (e.g., A, B, Distinction)",
    "result": "Result (PASS/FAIL)",
    "stream": "Stream (Science, Commerce, Arts, or General for 10th)",
    "subjects": [
      {
        "name": "Subject Name",
        "marksObtained": "Marks Obtained",
        "marksOutof": "Max Marks"
      }
    ]
  }
}

Important Rules:
1. Return ONLY the valid JSON object. No markdown formatting (\`\`\`json), no preamble, no explanations.
2. If a field is not visible or clear, use null or empty string "".
3. Ensure numbers are numbers, not strings.
4. "marksObtained" is the sum of marks obtained in all subjects. "marksOutof" is the sum of maximum marks.
5. "examination" field is CRITICAL. Look for keywords like "Secondary School Certificate" (SSC) or "Higher Secondary Certificate" (HSC).`;

        // Call Ollama
        const response = await callOllamaVision(base64Image, extractionPrompt);

        // Parse JSON response
        let extractedData;
        try {
            // Try to extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                extractedData = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found in response');
            }
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            return res.status(500).json({
                error: 'Failed to parse extracted data',
                rawResponse: response
            });
        }

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

// Endpoint: Verify document type
app.post('/api/verify-document', uploadMiddleware, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const expectedType = req.body.expectedType || 'HSC Marksheet';
        console.log(`Verifying document type: ${expectedType}...`);

        // Convert document (image or PDF) to base64
        const base64Image = await documentToBase64(req.file.buffer, req.file.mimetype);

        // Create verification prompt
        const verificationPrompt = `Analyze this image and determine if it is an ${expectedType}. 
    
Respond in JSON format:
{
  "isValid": true or false,
  "confidence": confidence score from 0 to 100,
  "documentType": "what type of document this appears to be",
  "reason": "brief explanation"
}

Only return the JSON object, nothing else.`;

        // Call Ollama
        const response = await callOllamaVision(base64Image, verificationPrompt);

        // Parse JSON response
        let verificationResult;
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                verificationResult = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found in response');
            }
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            return res.status(500).json({
                error: 'Failed to parse verification result',
                rawResponse: response
            });
        }

        console.log('Verification complete');
        res.json({
            success: true,
            verification: verificationResult
        });

    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({
            error: error.message || 'Failed to verify document'
        });
    }
});

// Endpoint: Validate passport photo
app.post('/api/validate-photo', uploadMiddleware, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        console.log('Validating passport photo...');

        // Convert document (image or PDF) to base64
        const base64Image = await documentToBase64(req.file.buffer, req.file.mimetype);

        // Create detailed prompt for validation
        const validationPrompt = `Analyze this image to determine if it is a valid passport-size photo for an admission form. 
        
        Strictly check for the following criteria:
        1. Is there a single clear human face?
        2. Are BOTH ears visible? (Crucial)
        3. Is the image NOT blurry?
        4. Is it a proper front-facing passport-style photo?
    
        Respond in JSON format ONLY:
        {
          "isValid": true or false,
          "errors": ["list", "of", "specific", "reasons", "if", "invalid", "otherwise", "empty"]
        }
        
        If the image is blurry, add "Image is too blurry" to errors.
        If both ears are not visible, add "Proper passport size photo required" to errors.
        If no human face is detected or multiple faces, add "Single human face required" to errors.
        If it's not a proper passport photo, add "Proper passport size photo required" to errors.
        
        Only return the JSON object, nothing else.`;

        // Call Ollama
        const response = await callOllamaVision(base64Image, validationPrompt);

        // Parse JSON response
        let validationResult;
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                validationResult = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found in response');
            }
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            return res.status(500).json({
                error: 'Failed to parse validation result',
                rawResponse: response
            });
        }

        console.log('Validation complete:', validationResult);
        res.json({
            success: true,
            validation: validationResult
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
    try {
        // Check if Ollama is running
        const ollamaResponse = await axios.get(`${OLLAMA_URL}/api/tags`);

        res.json({
            status: 'healthy',
            ollama: 'connected',
            url: OLLAMA_URL,
            models: ollamaResponse.data.models || []
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            ollama: 'disconnected',
            url: OLLAMA_URL,
            error: error.message
        });
    }
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled specific error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        details: err.message
    });
});

// Helper to check ports
async function checkOllamaPort(port) {
    try {
        await axios.get(`http://127.0.0.1:${port}/api/tags`);
        return true;
    } catch (e) {
        return false;
    }
}

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

        // Return format expected by SharedAdmissionFormComponent
        res.json({
            status: 1,
            message: 'File uploaded successfully',
            dataJson: {
                fileName: filename // The component expects 'fileName'
            }
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

        // Return format expected by SharedAdmissionFormComponent
        res.json({
            status: 1,
            message: 'Image uploaded successfully',
            dataJson: {
                fileName: filename
            }
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Start server
app.listen(PORT, async () => {
    console.log(`🚀 Document extraction backend running on port ${PORT}`);

    // Auto-detect Ollama port
    console.log('🔍 Probing Ollama ports...');
    const port11434 = await checkOllamaPort(11434);
    const port11435 = await checkOllamaPort(11435);

    if (port11434) {
        OLLAMA_URL = 'http://127.0.0.1:11434';
        console.log(`✅ Found Ollama running on port 11434`);
    } else if (port11435) {
        OLLAMA_URL = 'http://127.0.0.1:11435';
        console.log(`✅ Found Ollama running on port 11435`);
    } else {
        console.warn(`⚠️  Could not find Ollama on 11434 or 11435. Defaulting to ${OLLAMA_URL}`);
        console.warn(`   Please make sure Ollama is running: 'ollama serve'`);
    }

    console.log(`📡 Configured Ollama URL: ${OLLAMA_URL}`);
    console.log(`🔍 Endpoints:`);
    console.log(`   POST /api/extract-marksheet`);
    console.log(`   POST /api/verify-document`);
    console.log(`   POST /api/validate-photo`);
    console.log(`   POST /api/Admission/uploadPdf`);
    console.log(`   POST /api/Admission/uploadDocImage`);
    console.log(`   GET  /api/health`);
});
