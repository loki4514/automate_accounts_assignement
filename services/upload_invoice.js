import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Setup SQLite DB
const db = await open({
    filename: './receipts.db',
    driver: sqlite3.Database
});

// Setup multer to store PDFs in "uploads/" directory
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'uploads/';
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'), false);
        }
    }
});

// Middleware + controller in one
export const uploadPdf = [
    (req, res, next) => {
        upload.single('pdf')(req, res, function (err) {
            if (err instanceof multer.MulterError || err?.message === 'Only PDF files are allowed') {
                return res.status(400).json({
                    success: false,
                    message: err.message || 'Multer error'
                });
            } else if (err) {
                return res.status(500).json({
                    success: false,
                    message: 'File upload failed'
                });
            }
            next();
        });
    },
    async (req, res) => {
        try {
            const file = req.file;

            if (!file) {
                return res.status(400).json({
                    success: false,
                    message: 'No file uploaded'
                });
            }

            const filePath = path.resolve(file.path);
            const fileName = file.originalname;

            await db.run(
                `INSERT INTO uploaded_files (file_name, file_path, is_valid, is_processed)
                 VALUES (?, ?, ?, ?)`,
                [fileName, filePath, 1, 0]
            );

            return res.status(200).json({
                success: true,
                message: 'PDF uploaded and metadata stored successfully',
                file: {
                    name: fileName,
                    path: filePath
                }
            });
        } catch (error) {
            console.error('Upload error:', error);
            return res.status(500).json({
                success: false,
                message: 'Something went wrong during PDF upload'
            });
        }
    }
];
