import * as fs from 'fs/promises';
import path from 'path';
import { config } from '../config';

export class CleanupService {
    private static instance: CleanupService;
    private cleanupInterval: NodeJS.Timeout | null = null;

    private constructor() { }

    public static getInstance(): CleanupService {
        if (!CleanupService.instance) {
            CleanupService.instance = new CleanupService();
        }
        return CleanupService.instance;
    }

    /**
     * Cleanup old files from a directory
     * @param directory Directory to clean
     * @param maxAge Maximum age in milliseconds
     */
    private async cleanupDirectory(directory: string, maxAge: number): Promise<void> {
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
    private async runCleanup(): Promise<void> {
        await this.cleanupDirectory(config.directories.upload, config.cleanup.maxAge);
        await this.cleanupDirectory(config.directories.output, config.cleanup.maxAge);
        await this.cleanupDirectory(config.directories.temp, config.cleanup.maxAge);
    }

    /**
     * Initialize the cleanup service
     */
    public async initialize(): Promise<void> {
        try {
            // Create directories if they don't exist
            await fs.mkdir(config.directories.upload, { recursive: true });
            await fs.mkdir(config.directories.output, { recursive: true });

            // Run initial cleanup
            await this.runCleanup();

            // Schedule cleanup
            this.cleanupInterval = setInterval(() => {
                this.runCleanup().catch(error => {
                    console.error('Cleanup error:', error);
                });
            }, config.cleanup.interval);

            console.log('Cleanup service initialized');
            console.log('- Files older than 24 hours will be automatically deleted');
            console.log('- Cleanup runs every hour');
        } catch (error) {
            console.error('Failed to initialize cleanup service:', error);
            throw error;
        }
    }

    /**
     * Stop the cleanup service
     */
    public stop(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
} 