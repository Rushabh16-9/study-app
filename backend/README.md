# Document Extraction Backend

AI-powered document extraction service using Ollama's kimi-k2.5:cloud model.

## Prerequisites

- Node.js installed
- Ollama installed and running
- kimi-k2.5:cloud model pulled (`ollama pull kimi-k2.5:cloud`)

## Installation

```bash
cd backend
npm install
```

## Running the Server

```bash
npm start
```

The server will run on `http://localhost:3000`

## API Endpoints

### POST /api/extract-marksheet
Extract student data from HSC marksheet image.

**Request:**
- Content-Type: `multipart/form-data`
- Body: `document` (file)

**Response:**
```json
{
  "success": true,
  "data": {
    "personalInfo": {
      "firstName": "...",
      "middleName": "...",
      "lastName": "...",
      "mothersName": "...",
      "gender": "Male/Female"
    },
    "academicInfo": {
      "board": "...",
      "passingYear": 2024,
      "subjects": [...],
      "totalMarks": 500,
      "percentage": 85.5
    }
  }
}
```

### POST /api/verify-document
Verify if uploaded document matches expected type.

**Request:**
- Content-Type: `multipart/form-data`
- Body: `document` (file), `expectedType` (string)

**Response:**
```json
{
  "success": true,
  "verification": {
    "isValid": true,
    "confidence": 95,
    "documentType": "HSC Marksheet",
    "reason": "..."
  }
}
```

### GET /api/health
Check backend and Ollama connection status.

## Environment Variables

Create a `.env` file:

```
PORT=3000
OLLAMA_URL=http://localhost:11434
```

## Troubleshooting

**Backend not starting:**
- Ensure Node.js is installed
- Run `npm install` in backend directory

**Ollama connection failed:**
- Ensure Ollama is running: `ollama serve`
- Verify model is pulled: `ollama list`

**Extraction errors:**
- Check image quality and format (JPEG, PNG, PDF)
- Ensure image contains clear text
- Try with different images
