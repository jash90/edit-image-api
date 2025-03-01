import { removeBackground } from '@imgly/background-removal-node';
import * as fs from 'fs/promises';
import sharp from 'sharp';
import * as tf from '@tensorflow/tfjs-node';
import path from 'path';

// Import using require for better compatibility with upscaler packages
const Upscaler = require('upscaler/node');
const x4Model = require('@upscalerjs/esrgan-thick/4x');

export class ImageService {
    private static instance: ImageService;

    private constructor() { }

    public static getInstance(): ImageService {
        if (!ImageService.instance) {
            ImageService.instance = new ImageService();
        }
        return ImageService.instance;
    }

    /**
     * Upscales an image using AI model
     * @param inputPath Path to the input image
     * @param outputPath Path where the upscaled image will be saved
     */
    public async upscaleImage(inputPath: string, outputPath: string): Promise<void> {
        const inputImageBuffer = await fs.readFile(inputPath);
        const inputTensor = tf.node.decodeImage(inputImageBuffer, 3) as tf.Tensor3D;

        try {
            const upscaler = new Upscaler({ model: x4Model });
            const upscaledTensor = await upscaler.upscale(inputTensor) as tf.Tensor3D;
            const outputPngBuffer = await tf.node.encodePng(upscaledTensor);
            await fs.writeFile(outputPath, outputPngBuffer);

            // Cleanup
            inputTensor.dispose();
            upscaledTensor.dispose();
        } catch (error) {
            // Ensure tensor is disposed even if error occurs
            inputTensor.dispose();
            throw error;
        }
    }

    /**
     * Removes background from a PNG image
     * @param inputPath Path to the input PNG image
     * @param outputPath Path where the processed image will be saved
     */
    public async removeBackgroundFromPng(inputPath: string, outputPath: string): Promise<void> {
        try {
            const imageBuffer = await sharp(inputPath)
                .png()
                .toBuffer();

            const imageBlob = new Blob([imageBuffer], { type: "image/png" });
            const resultBlob = await removeBackground(imageBlob);
            const arrayBuffer = await resultBlob.arrayBuffer();
            const outputBuffer = Buffer.from(arrayBuffer);

            await fs.writeFile(outputPath, outputBuffer);
        } catch (error) {
            console.error("Error removing background:", error);
            throw error;
        }
    }

    /**
     * Converts JPEG/JPG image to PNG format
     * @param inputPath Path to the input JPEG image
     * @returns Path to the converted PNG image
     */
    public async convertJpegToPng(inputPath: string): Promise<string> {
        const fileExt = path.extname(inputPath);
        const baseName = path.basename(inputPath, fileExt);
        const outputPath = path.join(path.dirname(inputPath), `${baseName}.png`);

        try {
            const imageData = await fs.readFile(inputPath);
            await sharp(imageData)
                .png()
                .toFile(outputPath);

            return outputPath;
        } catch (error) {
            console.error(`Error converting to PNG:`, error);
            throw error;
        }
    }
}