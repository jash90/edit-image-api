# Background Removal and Upscaling API

This API provides endpoints for removing backgrounds from images and optionally upscaling them using AI models.

## Features

- Remove backgrounds from images using the `@imgly/background-removal-node` library
- Upscale images using the ESRGAN 4x AI model
- Support for both single image and batch processing
- Automatic conversion of JPEG/JPG to PNG format
- Clean temporary files after processing

## Installation

1. Clone the repository
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

The server will start on port 3000 by default. You can change this by setting the `PORT` environment variable.

## API Endpoints

### Health Check

```
GET /api/health
```

Returns a simple status message to check if the API is running.

**Response:**

```json
{
  "status": "ok"
}
```

### Process Single Image

```
POST /api/process-image
```

Processes a single image by removing its background and optionally upscaling it.

**Request:**

- Content-Type: `multipart/form-data`
- Body:
  - `image`: The image file to process (JPG or PNG)
  - `upscale`: Set to "true" to upscale the image (optional)

**Response:**

- Content-Type: `image/png`
- Body: The processed image as a PNG file

### Batch Process Images

```
POST /api/batch-process
```

Processes multiple images by removing their backgrounds and optionally upscaling them.

**Request:**

- Content-Type: `multipart/form-data`
- Body:
  - `images`: The image files to process (JPG or PNG)
  - `upscale`: Set to "true" to upscale the images (optional)

**Response:**

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
      "error": "Failed to process image"
    }
  ]
}
```

## Example Usage

### Using cURL

```bash
# Process a single image
curl -X POST -F "image=@path/to/image.jpg" -F "upscale=true" http://localhost:3000/api/process-image --output processed.png

# Batch process multiple images
curl -X POST -F "images=@path/to/image1.jpg" -F "images=@path/to/image2.jpg" -F "upscale=true" http://localhost:3000/api/batch-process
```

### Using JavaScript Fetch API

```javascript
// Process a single image
const formData = new FormData();
formData.append('image', imageFile);
formData.append('upscale', 'true');

fetch('http://localhost:3000/api/process-image', {
  method: 'POST',
  body: formData
})
.then(response => response.blob())
.then(blob => {
  const url = URL.createObjectURL(blob);
  // Use the processed image URL
});

// Batch process multiple images
const batchFormData = new FormData();
imageFiles.forEach(file => {
  batchFormData.append('images', file);
});
batchFormData.append('upscale', 'true');

fetch('http://localhost:3000/api/batch-process', {
  method: 'POST',
  body: batchFormData
})
.then(response => response.json())
.then(data => {
  // Process the results
  data.results.forEach(result => {
    if (result.success) {
      // Use result.data (base64 image)
    } else {
      // Handle error: result.error
    }
  });
});
```

## Dependencies

- Express.js - Web server framework
- TensorFlow.js - Machine learning framework
- Sharp - Image processing library
- @imgly/background-removal-node - Background removal library
- Upscaler - Image upscaling library with ESRGAN model

## License

ISC 