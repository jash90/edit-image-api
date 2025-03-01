import express from 'express';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import path from 'path';
import { config } from './config';
import { CleanupService } from './services/cleanup.service';
import apiRoutes from './routes/api.routes';

// Create Express app
const app = express();

// Configure middleware
app.use(cors());
app.use(express.json());
app.use(fileUpload({
    limits: { fileSize: config.uploadLimit },
    useTempFiles: true,
    tempFileDir: config.directories.temp
}));

// Serve static files from the public directory
app.use(express.static(config.directories.public));

// Initialize cleanup service
const cleanupService = CleanupService.getInstance();
cleanupService.initialize().catch(error => {
    console.error('Failed to initialize cleanup service:', error);
    process.exit(1);
});

// Mount API routes
app.use('/api', apiRoutes);

// Start the server
app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
    console.log(`API endpoints:`);
    console.log(`- GET  /api/health - Health check`);
    console.log(`- POST /api/process-image - Process a single image`);
    console.log(`- POST /api/batch-process - Process multiple images`);
    console.log(`\nFile cleanup:`);
    console.log(`- Uploaded and processed files are automatically deleted after 24 hours`);
    console.log(`- Cleanup runs every hour`);
});