import { removeBackground } from "@imgly/background-removal-node";
import * as fs from "fs/promises";
import sharp from "sharp";
import * as tf from '@tensorflow/tfjs-node';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Import przy użyciu require dla lepszej kompatybilności z paczkami upscaler
const Upscaler = require('upscaler/node');
const x4Model = require('@upscalerjs/esrgan-thick/4x');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Configure middleware
app.use(cors());
app.use(express.json());
app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
    useTempFiles: true,
    tempFileDir: '/tmp/'
}));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Create upload and output directories if they don't exist
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const OUTPUT_DIR = path.join(__dirname, 'output');
const TEMP_DIR = '/tmp';

/**
 * Cleanup old files from a directory
 * @param directory Directory to clean
 * @param maxAge Maximum age in milliseconds
 */
async function cleanupDirectory(directory: string, maxAge: number) {
    try {
        const files = await fs.readdir(directory);
        const now = Date.now();

        for (const file of files) {
            const filePath = path.join(directory, file);
            try {
                const stats = await fs.stat(filePath);
                if (now - stats.mtimeMs > maxAge) {
                    await fs.unlink(filePath);
                    console.log(`Cleaned up old file: ${filePath}`);
                }
            } catch (error) {
                console.error(`Error processing file ${filePath}:`, error);
            }
        }
    } catch (error) {
        console.error(`Error cleaning directory ${directory}:`, error);
    }
}

/**
 * Run cleanup on all directories
 */
async function runCleanup() {
    const ONE_DAY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    await cleanupDirectory(UPLOAD_DIR, ONE_DAY);
    await cleanupDirectory(OUTPUT_DIR, ONE_DAY);
    await cleanupDirectory(TEMP_DIR, ONE_DAY);
}

// Initialize directories and cleanup schedule
async function initialize() {
    // Create directories if they don't exist
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    // Run initial cleanup
    await runCleanup();

    // Schedule cleanup every hour
    setInterval(runCleanup, 60 * 60 * 1000);
}

// Start initialization
initialize().catch(error => {
    console.error('Initialization error:', error);
});

/**
 * Upscales an image using AI model
 * @param inputPath Path to the input image
 * @param outputPath Path where the upscaled image will be saved
 */
async function upscaleImage(inputPath: string, outputPath: string): Promise<void> {
    // 1. Wczytanie obrazu z pliku i dekodowanie go do tensora (tablicy pikseli)
    const inputImageBuffer = await fs.readFile(inputPath);
    const inputTensor = tf.node.decodeImage(inputImageBuffer, 3) as tf.Tensor3D;
    // (drugi parametr "3" oznacza 3 kanały kolorów RGB)

    // 2. Inicjalizacja upscalera z wybranym modelem AI (ESRGAN 4×) – używamy "new"
    const upscaler = new Upscaler({ model: x4Model });

    // 3. Powiększenie obrazu 4× za pomocą modelu AI 
    const upscaledTensor = await upscaler.upscale(inputTensor) as tf.Tensor3D;

    // 4. Zakodowanie wyniku do formatu PNG (Uint8Array z danymi obrazka)
    const outputPngBuffer = await tf.node.encodePng(upscaledTensor);

    // 5. Zapisanie danych PNG do pliku wyjściowego
    await fs.writeFile(outputPath, outputPngBuffer);

    // 6. Zwolnienie pamięci (usunięcie tensorów z pamięci)
    inputTensor.dispose();
    upscaledTensor.dispose();
}

/**
 * Removes background from a PNG image
 * @param inputPath Path to the input PNG image
 * @param outputPath Path where the processed image will be saved
 */
async function removeBackgroundFromPng(inputPath: string, outputPath: string): Promise<void> {
    try {
        // Konwersja obrazu do poprawnego PNG
        const imageBuffer = await sharp(inputPath)
            .png()
            .toBuffer();

        // Utwórz Blob z ustawionym typem MIME
        const imageBlob = new Blob([imageBuffer], { type: "image/png" });

        // Wywołanie funkcji usuwania tła
        const resultBlob = await removeBackground(imageBlob);

        // Konwersja Blob -> ArrayBuffer -> Buffer
        const arrayBuffer = await resultBlob.arrayBuffer();
        const outputBuffer = Buffer.from(arrayBuffer);

        // Zapisz wynik do pliku
        await fs.writeFile(outputPath, outputBuffer);
    } catch (error) {
        console.error("Błąd podczas usuwania tła:", error);
        throw error;
    }
}

/**
 * Converts JPEG/JPG image to PNG format
 * @param inputPath Path to the input JPEG image
 * @returns Path to the converted PNG image
 */
async function convertJpegToPng(inputPath: string): Promise<string> {
    try {
        const fileExt = path.extname(inputPath);
        const baseName = path.basename(inputPath, fileExt);
        const outputPath = path.join(path.dirname(inputPath), `${baseName}.png`);

        // Odczytaj plik JPEG
        const imageData = await fs.readFile(inputPath);

        // Konwertuj JPEG do PNG przy użyciu Sharp
        await sharp(imageData)
            .png()
            .toFile(outputPath);

        return outputPath;
    } catch (error) {
        console.error(`Błąd podczas konwersji do PNG:`, error);
        throw error;
    }
}

// API Routes

/**
 * Health check endpoint
 */
app.get('/api/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
});

/**
 * Process image endpoint - removes background and optionally upscales
 */
app.post('/api/process-image', (req: Request, res: Response) => {
    (async () => {
        try {
            if (!req.files || !req.files.image) {
                return res.status(400).json({ error: 'No image file uploaded' });
            }

            const image = req.files.image as fileUpload.UploadedFile;
            const shouldUpscale = req.body.upscale === 'true';

            // Generate unique filename
            const fileId = uuidv4();
            const fileExt = path.extname(image.name).toLowerCase();
            const uploadPath = path.join(UPLOAD_DIR, `${fileId}${fileExt}`);

            // Save uploaded file
            await image.mv(uploadPath);

            // Process paths
            let processedPath: string;

            // Convert to PNG if needed
            if (fileExt === '.jpg' || fileExt === '.jpeg') {
                processedPath = await convertJpegToPng(uploadPath);
            } else if (fileExt === '.png') {
                processedPath = uploadPath;
            } else {
                await fs.unlink(uploadPath);
                return res.status(400).json({ error: 'Unsupported file format. Please upload JPG or PNG.' });
            }

            // Final output path
            const outputPath = path.join(OUTPUT_DIR, `${fileId}.png`);

            // Process the image
            if (shouldUpscale) {
                // First upscale, then remove background
                const upscaledPath = path.join(OUTPUT_DIR, `${fileId}_upscaled.png`);
                await upscaleImage(processedPath, upscaledPath);
                await removeBackgroundFromPng(upscaledPath, outputPath);

                // Clean up intermediate file
                await fs.unlink(upscaledPath);
            } else {
                // Just remove background
                await removeBackgroundFromPng(processedPath, outputPath);
            }

            // Clean up uploaded file if it's different from processed path
            if (uploadPath !== processedPath) {
                await fs.unlink(uploadPath);
            }

            // Return the processed image
            const imageBuffer = await fs.readFile(outputPath);
            res.set('Content-Type', 'image/png');
            res.send(imageBuffer);

            // Clean up output file after sending
            await fs.unlink(outputPath);

        } catch (error) {
            console.error('Error processing image:', error);
            res.status(500).json({ error: 'Failed to process image' });
        }
    })();
});

/**
 * Batch processing endpoint - processes multiple images
 */
app.post('/api/batch-process', (req: Request, res: Response) => {
    (async () => {
        try {
            if (!req.files || !req.files.images) {
                return res.status(400).json({ error: 'No image files uploaded' });
            }

            const shouldUpscale = req.body.upscale === 'true';
            let images = req.files.images as fileUpload.UploadedFile[];

            // If only one file was uploaded, convert to array
            if (!Array.isArray(images)) {
                images = [images];
            }

            const results = [];

            for (const image of images) {
                try {
                    // Generate unique filename
                    const fileId = uuidv4();
                    const fileExt = path.extname(image.name).toLowerCase();
                    const uploadPath = path.join(UPLOAD_DIR, `${fileId}${fileExt}`);

                    // Save uploaded file
                    await image.mv(uploadPath);

                    // Process paths
                    let processedPath: string;

                    // Convert to PNG if needed
                    if (fileExt === '.jpg' || fileExt === '.jpeg') {
                        processedPath = await convertJpegToPng(uploadPath);
                    } else if (fileExt === '.png') {
                        processedPath = uploadPath;
                    } else {
                        await fs.unlink(uploadPath);
                        results.push({
                            filename: image.name,
                            success: false,
                            error: 'Unsupported file format. Please upload JPG or PNG.'
                        });
                        continue;
                    }

                    // Final output path
                    const outputPath = path.join(OUTPUT_DIR, `${fileId}.png`);

                    // Process the image
                    if (shouldUpscale) {
                        // First upscale, then remove background
                        const upscaledPath = path.join(OUTPUT_DIR, `${fileId}_upscaled.png`);
                        await upscaleImage(processedPath, upscaledPath);
                        await removeBackgroundFromPng(upscaledPath, outputPath);

                        // Clean up intermediate file
                        await fs.unlink(upscaledPath);
                    } else {
                        // Just remove background
                        await removeBackgroundFromPng(processedPath, outputPath);
                    }

                    // Clean up uploaded file if it's different from processed path
                    if (uploadPath !== processedPath) {
                        await fs.unlink(uploadPath);
                    }

                    // Read the processed image
                    const imageBuffer = await fs.readFile(outputPath);
                    const base64Image = imageBuffer.toString('base64');

                    results.push({
                        filename: image.name,
                        success: true,
                        data: `data:image/png;base64,${base64Image}`
                    });

                    // Clean up output file
                    await fs.unlink(outputPath);

                } catch (error) {
                    console.error(`Error processing image ${image.name}:`, error);
                    results.push({
                        filename: image.name,
                        success: false,
                        error: 'Failed to process image'
                    });
                }
            }

            res.json({ results });

        } catch (error) {
            console.error('Error in batch processing:', error);
            res.status(500).json({ error: 'Failed to process images' });
        }
    })();
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API endpoints:`);
    console.log(`- GET  /api/health - Health check`);
    console.log(`- POST /api/process-image - Process a single image`);
    console.log(`- POST /api/batch-process - Process multiple images`);
    console.log(`\nFile cleanup:`);
    console.log(`- Uploaded and processed files are automatically deleted after 24 hours`);
    console.log(`- Cleanup runs every hour`);
});