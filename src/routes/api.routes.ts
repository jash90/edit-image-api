import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import * as fs from 'fs/promises';
import fileUpload from 'express-fileupload';
import { config } from '../config';
import { ImageService } from '../services/image.service';
const router = express.Router();
const imageService = ImageService.getInstance();

/**
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
});

/**
 * Process image endpoint - removes background and optionally upscales
 */
router.post('/process-image', (req: Request, res: Response) => {
    (async () => {
        try {
            if (!req.files || !req.files.image) {
                return res.status(400).json({ error: 'No image file uploaded' });
            }

            const image = req.files.image as fileUpload.UploadedFile;
            const shouldUpscale = req.body.upscale === 'true';
            const shouldRemoveBackground = req.body.removeBackground === 'true';

            if (!shouldUpscale && !shouldRemoveBackground) {
                return res.status(400).json({ error: 'No processing option selected' });
            }

            // Generate unique filename
            const fileId = uuidv4();
            const fileExt = path.extname(image.name).toLowerCase();
            const uploadPath = path.join(config.directories.upload, `${fileId}${fileExt}`);

            // Save uploaded file
            await image.mv(uploadPath);

            // Process paths
            let processedPath: string;

            // Convert to PNG if needed
            if (fileExt === '.jpg' || fileExt === '.jpeg') {
                processedPath = await imageService.convertJpegToPng(uploadPath);
            } else if (fileExt === '.png') {
                processedPath = uploadPath;
            } else {
                await fs.unlink(uploadPath);
                return res.status(400).json({ error: 'Unsupported file format. Please upload JPG or PNG.' });
            }

            // Final output path
            const outputPath = path.join(config.directories.output, `${fileId}.png`);

            // Process the image
            if (shouldUpscale && shouldRemoveBackground) {
                // First upscale, then remove background
                const upscaledPath = path.join(config.directories.output, `${fileId}_upscaled.png`);
                await imageService.upscaleImage(processedPath, upscaledPath);
                await imageService.removeBackgroundFromPng(upscaledPath, outputPath);
                await fs.unlink(upscaledPath);
            } else if (shouldUpscale) {
                await imageService.upscaleImage(processedPath, outputPath);
            } else {
                await imageService.removeBackgroundFromPng(processedPath, outputPath);
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
router.post('/batch-process', (req: Request, res: Response) => {
    (async () => {
        try {
            if (!req.files || !req.files.images) {
                return res.status(400).json({ error: 'No image files uploaded' });
            }

            const shouldUpscale = req.body.upscale === 'true';
            const shouldRemoveBackground = req.body.removeBackground === 'true';

            if (!shouldUpscale && !shouldRemoveBackground) {
                return res.status(400).json({ error: 'No processing option selected' });
            }

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
                    const uploadPath = path.join(config.directories.upload, `${fileId}${fileExt}`);

                    // Save uploaded file
                    await image.mv(uploadPath);

                    // Process paths
                    let processedPath: string;

                    // Convert to PNG if needed
                    if (fileExt === '.jpg' || fileExt === '.jpeg') {
                        processedPath = await imageService.convertJpegToPng(uploadPath);
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
                    const outputPath = path.join(config.directories.output, `${fileId}.png`);

                    // Process the image
                    if (shouldUpscale && shouldRemoveBackground) {
                        // First upscale, then remove background
                        const upscaledPath = path.join(config.directories.output, `${fileId}_upscaled.png`);
                        await imageService.upscaleImage(processedPath, upscaledPath);
                        await imageService.removeBackgroundFromPng(upscaledPath, outputPath);
                        await fs.unlink(upscaledPath);
                    } else if (shouldUpscale) {
                        await imageService.upscaleImage(processedPath, outputPath);
                    } else {
                        await imageService.removeBackgroundFromPng(processedPath, outputPath);
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

export default router; 