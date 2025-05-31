import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const db = await open({
    filename: './receipts.db',
    driver: sqlite3.Database
});

// Create tables
await db.exec(`
  CREATE TABLE IF NOT EXISTS uploaded_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    is_valid BOOLEAN DEFAULT 1,
    invalid_reason TEXT,
    is_processed BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS extracted_receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchased_at DATETIME,
    merchant_name TEXT,
    total_amount REAL,
    file_path TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

console.log("Both tables created ✅");
