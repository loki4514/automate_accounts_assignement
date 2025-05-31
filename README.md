# 🧾 PDF Receipt Processing API

This API allows uploading, validating, processing, and retrieving PDF receipts with metadata and extracted info.

---

## 🚀 Project Setup

```bash
# Clone the project
git clone https://github.com/loki4514
cd automate_accounts_assignment

# Install dependencies
npm install

# Install SQLite3 CLI (if not already)
# Windows: https://www.sqlite.org/download.html
# macOS (Homebrew): brew install sqlite3
# Ubuntu: sudo apt install sqlite3

# Start the server
npm run start
```
---

## 🛠 Database Setup

### File: `models/create_model.js`

```js
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const initializeDB = async () => {
    const db = await open({
        filename: './receipts.db',
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS uploaded_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            is_valid INTEGER DEFAULT 1,
            is_processed INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await db.exec(`
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
};

initializeDB();
```

---

## 📤 Upload a Receipt

### `POST /api/v1/upload`

```bash
curl --location 'http://localhost:8000/api/v1/upload' --form 'pdf=@"/path/to/your/receipt.pdf"'
```

#### ✅ Success Response

```json
{
  "success": true,
  "message": "PDF uploaded and metadata stored successfully",
  "file": {
    "name": "receipt.pdf",
    "path": "uploads/1748676269189-receipt.pdf"
  }
}
```

#### ❌ Errors

```json
{
  "success": false,
  "message": "Only PDF files are allowed"
}
```

---

## 📥 Get All Receipts

### `GET /api/v1/receipts`

```bash
curl --location 'http://localhost:8000/api/v1/receipts'
```

#### ✅ Success Response

```json
{
  "success": true,
  "data": [
    {
      "uploaded_id": 1,
      "file_name": "receipt.pdf",
      "file_path": "uploads/...",
      "is_valid": 1,
      "is_processed": 1,
      "uploaded_created_at": "...",
      "extracted_id": 1,
      "purchased_at": "28-11-2023 20:35",
      "merchant_name": "BeerHaus",
      "total_amount": 41.72,
      "extracted_created_at": "..."
    }
  ]
}
```

---

## 🔍 Get Receipt by ID

### `GET /api/v1/receipts/:id`

```bash
curl --location 'http://localhost:8000/api/v1/receipts/1'
```

#### ✅ Found

```json
{
  "success": true,
  "data": {
    "uploaded_id": 1,
    ...
    "merchant_name": "BeerHaus"
  }
}
```

#### ❌ Not Found

```json
{
  "success": false,
  "message": "Receipt not found"
}
```

---

## 🧠 Process a Receipt (OCR + AI)

### `POST /api/v1/process/:id`

```bash
curl --location --request POST 'http://localhost:8000/api/v1/process/1'
```

#### ✅ Successful Extraction

```json
{
  "success": true,
  "message": "Receipt processed successfully",
  "data": {
    "companyName": "BeerHaus",
    "date": "28-11-2023 20:35",
    "amount": "41.72",
    "totalAmount": 41.72,
    "confidence": "high"
  }
}
```

#### ❌ Failed Extraction

```json
{
  "success": false,
  "message": "Failed to extract valid receipt data",
  "data": {
    "companyName": "or - wa",
    "date": "",
    "amount": "",
    "totalAmount": 0,
    "extractedText": "raw OCR dump here..."
  }
}
```

---

## 📁 File Upload Directory

Uploaded PDFs are saved in:

```
uploads/
```

Make sure the folder has write permission.

---

## 🔐 Notes

- Only PDFs are accepted.
- Extraction depends on the receipt clarity (low quality = failed extraction).
- `file_path` links uploaded + extracted records.

---

## 👨‍💻 Author

Built by [Lokesh R](https://github.com/loki4514)