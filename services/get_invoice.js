import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

// Open the SQLite database
const db = await open({
    filename: './receipts.db',
    driver: sqlite3.Database
});

// GET /receipts – list all receipts with extracted data (if any)
export const getAllReceipts = async (req, res) => {
    try {
        const query = `
            SELECT 
                uf.id AS uploaded_id,
                uf.file_name,
                uf.file_path,
                uf.is_valid,
                uf.is_processed,
                uf.created_at AS uploaded_created_at,
                er.id AS extracted_id,
                er.purchased_at,
                er.merchant_name,
                er.total_amount,
                er.created_at AS extracted_created_at
            FROM uploaded_files uf
            LEFT JOIN extracted_receipts er ON uf.file_path = er.file_path
            ORDER BY uf.created_at DESC
        `;

        const receipts = await db.all(query);
        return res.status(200).json({ success: true, data: receipts });
    } catch (error) {
        console.error('Error fetching receipts:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch receipts' });
    }
};

// GET /receipts/:id – get a single receipt with extracted data
export const getReceiptById = async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
            SELECT 
                uf.id AS uploaded_id,
                uf.file_name,
                uf.file_path,
                uf.is_valid,
                uf.is_processed,
                uf.created_at AS uploaded_created_at,
                er.id AS extracted_id,
                er.purchased_at,
                er.merchant_name,
                er.total_amount,
                er.created_at AS extracted_created_at
            FROM uploaded_files uf
            LEFT JOIN extracted_receipts er ON uf.file_path = er.file_path
            WHERE uf.id = ?
        `;

        const receipt = await db.get(query, [id]);

        if (!receipt) {
            return res.status(404).json({ success: false, message: 'Receipt not found' });
        }

        return res.status(200).json({ success: true, data: receipt });
    } catch (error) {
        console.error('Error fetching receipt by ID:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch receipt' });
    }
};
