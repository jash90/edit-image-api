import path from 'path';

export const config = {
    port: process.env.PORT || 3001,
    uploadLimit: 50 * 1024 * 1024, // 50MB
    directories: {
        upload: path.join(__dirname, '..', 'uploads'),
        output: path.join(__dirname, '..', 'output'),
        temp: '/tmp',
        public: path.join(__dirname, '..', 'public')
    },
    cleanup: {
        interval: 60 * 60 * 1000, // 1 hour in milliseconds
        maxAge: 24 * 60 * 60 * 1000 // 24 hours in milliseconds
    }
}; 