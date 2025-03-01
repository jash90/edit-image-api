# AI Image Processing API

A powerful Node.js API for image processing using AI models. This service provides background removal and image upscaling capabilities, with support for both single and batch processing.

## 🌟 Features

- **Background Removal**: Remove backgrounds from images using AI
- **Image Upscaling**: Enhance image resolution using ESRGAN 4x AI model
- **Combined Processing**: Remove background and upscale in one go
- **Batch Processing**: Process multiple images simultaneously
- **Format Support**: Automatic JPEG/JPG to PNG conversion
- **Auto Cleanup**: Automatic cleanup of temporary files after 24 hours

## 🚀 Getting Started

### Prerequisites

- Node.js 16.x or higher
- npm or yarn
- At least 4GB RAM (recommended for AI processing)

### Installation

1. Clone the repository:
```bash
git clone [your-repo-url]
cd [your-repo-name]
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Build the project:
```bash
npm run build
# or
yarn build
```

4. Start the server:
```bash
npm start
# or
yarn start
```

The server will start on port 3001 by default. You can change this by setting the `PORT` environment variable.

## 📡 API Endpoints

### Health Check
```http
GET /api/health
```
Check if the API is running.

#### Response
```json
{
  "status": "ok"
}
```

### Process Single Image
```http
POST /api/process-image
```
Process a single image with background removal and/or upscaling.

#### Request
- Content-Type: `multipart/form-data`
- Body Parameters:
  - `image`: Image file (JPG or PNG)
  - `removeBackground`: Set to "true" to remove background
  - `upscale`: Set to "true" to upscale the image

#### Response
- Content-Type: `image/png`
- Body: Processed image as PNG file

### Batch Process Images
```http
POST /api/batch-process
```
Process multiple images simultaneously.

#### Request
- Content-Type: `multipart/form-data`
- Body Parameters:
  - `images`: Multiple image files (JPG or PNG)
  - `removeBackground`: Set to "true" to remove background
  - `upscale`: Set to "true" to upscale images

#### Response
```json
{
  "results": [
    {
      "filename": "image1.jpg",
      "success": true,
      "data": "data:image/png;base64,..."
    },
    {
      "filename": "image2.jpg",
      "success": false,
      "error": "Error message"
    }
  ]
}
```

## 💻 Usage Examples

### cURL

```bash
# Process single image (remove background)
curl -X POST \
  -F "image=@/path/to/image.jpg" \
  -F "removeBackground=true" \
  http://localhost:3001/api/process-image \
  --output processed.png

# Process single image (remove background and upscale)
curl -X POST \
  -F "image=@/path/to/image.jpg" \
  -F "removeBackground=true" \
  -F "upscale=true" \
  http://localhost:3001/api/process-image \
  --output processed.png

# Batch process multiple images
curl -X POST \
  -F "images=@/path/to/image1.jpg" \
  -F "images=@/path/to/image2.jpg" \
  -F "removeBackground=true" \
  -F "upscale=true" \
  http://localhost:3001/api/batch-process
```

### JavaScript

```javascript
// Single image processing
async function processImage(imageFile) {
  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append('removeBackground', 'true');
  formData.append('upscale', 'true');

  const response = await fetch('http://localhost:3001/api/process-image', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) throw new Error('Processing failed');
  return await response.blob();
}

// Batch processing
async function processBatch(imageFiles) {
  const formData = new FormData();
  imageFiles.forEach(file => {
    formData.append('images', file);
  });
  formData.append('removeBackground', 'true');
  formData.append('upscale', 'true');

  const response = await fetch('http://localhost:3001/api/batch-process', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) throw new Error('Batch processing failed');
  return await response.json();
}
```

## 🛠 Technical Details

### File Cleanup
- Uploaded and processed files are automatically deleted after 24 hours
- Cleanup service runs every hour
- Temporary files are stored in:
  - Upload directory: `./uploads`
  - Output directory: `./output`
  - Temp directory: `/tmp`

### File Size Limits
- Maximum file size: 50MB per image
- Supported formats: JPG, JPEG, PNG

## 📚 Dependencies

- **Express.js**: Web server framework
- **TensorFlow.js**: Machine learning framework for image processing
- **Sharp**: High-performance image processing
- **@imgly/background-removal-node**: AI-powered background removal
- **upscaler**: Image upscaling with ESRGAN model
- **express-fileupload**: File upload middleware
- **cors**: Cross-origin resource sharing support

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the ISC License. 