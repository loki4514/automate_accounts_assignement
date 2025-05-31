import path from 'path';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import pdf from 'pdf-poppler';
import Tesseract from 'tesseract.js';

// Assuming you have a DB module, e.g., sqlite with promises
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

// Open the SQLite database
const db = await open({
    filename: './receipts.db',
    driver: sqlite3.Database
});

const outputDir = path.join(process.cwd(), 'temp');

const ensureOutputDir = async () => {
    if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
        console.log('✅ Created temp output folder');
    }
};

const convertPdfToImages = async (pdfPath) => {
    const options = {
        format: 'jpeg',
        out_dir: outputDir,
        out_prefix: path.basename(pdfPath, '.pdf'),
        page: null,
    };

    try {
        await pdf.convert(pdfPath, options);
        const files = await fs.readdir(outputDir);

        const pdfBaseName = path.basename(pdfPath, '.pdf');

        const filteredFiles = files.filter(file =>
            file.startsWith(pdfBaseName) && (file.endsWith('.jpg') || file.endsWith('.jpeg'))
        );

        filteredFiles.sort((a, b) => {
            const getPageNum = (filename) => {
                const match = filename.match(/-(\d+)\.jpe?g$/i);
                return match ? parseInt(match[1], 10) : 0;
            };
            return getPageNum(a) - getPageNum(b);
        });

        return filteredFiles.map(file => path.join(outputDir, file));
    } catch (error) {
        console.error('❌ PDF conversion failed:', error);
        return [];
    }
};

const runTesseractOnImages = async (imagePaths) => {
    let fullText = '';

    for (const imagePath of imagePaths) {
        try {
            const { data: { text } } = await Tesseract.recognize(imagePath, 'eng');
            fullText += `\n\n${text}`;
            console.log(`OCR text from ${imagePath}:`, text);
        } catch (err) {
            console.error(`❌ OCR failed for ${imagePath}:`, err);
        }
    }
    return fullText;
};

const extractAmount = (text) => {
    const cleanedText = text.replace(/\r/g, '').replace(/\n/g, ' ');
    
    // Multiple patterns to catch different total formats
    const patterns = [
        // Standard total patterns
        /(?:total|grand\s*total|final\s*total|amount\s*due|balance\s*due)[:\s]*[\$]?([\d,]+\.?\d{0,2})/i,
        
        // Subtotal patterns (fallback)
        /(?:sub\s*total|subtotal|sub_total)[:\s]*[\$]?([\d,]+\.?\d{0,2})/i,
        
        // Amount patterns
        /(?:total\s*amount|amount\s*total|net\s*amount)[:\s]*[\$]?([\d,]+\.?\d{0,2})/i,
        
        // Currency symbol patterns
        /\$\s*([\d,]+\.?\d{0,2})(?=\s*(?:total|due|amount|balance))/i,
        
        // Line-end total patterns (common in receipts)
        /(?:^|\n)\s*(?:total|amount)[:\s]*[\$]?([\d,]+\.?\d{0,2})\s*(?:$|\n)/im,
        
        // Generic money pattern as last resort
        /[\$]\s*([\d,]+\.\d{2})/g
    ];
    
    for (const pattern of patterns) {
        const matches = cleanedText.match(pattern);
        if (matches) {
            const amount = matches[1].replace(/,/g, '');
            const numAmount = parseFloat(amount);
            // Reasonable amount range check
            if (numAmount > 0 && numAmount < 10000) {
                console.log(`Found amount: ${amount} using pattern: ${pattern}`);
                return amount;
            }
        }
    }
    
    console.log('No amount found in text');
    return '';
};

const parseDateTime = (dateStr) => {
    console.log(`Parsing datetime: "${dateStr}"`);
    
    // Clean the input
    const cleaned = dateStr.trim().replace(/\s+/g, ' ');
    
    // Multiple date/time patterns
    const patterns = [
        // MM/DD/YYYY HH:MM or MM-DD-YYYY HH:MM
        /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/,
        
        // DD/MM/YYYY HH:MM or DD-MM-YYYY HH:MM  
        /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/,
        
        // YYYY-MM-DD HH:MM:SS
        /(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/,
        
        // Date only patterns
        /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,
        /(\d{4})-(\d{1,2})-(\d{1,2})/,
        
        // Time only patterns
        /(\d{1,2}):(\d{2})(?::(\d{2}))?/
    ];
    
    for (const pattern of patterns) {
        const match = cleaned.match(pattern);
        if (match) {
            if (pattern.toString().includes('\\d{4}-\\d{1,2}-\\d{1,2}')) {
                // YYYY-MM-DD format
                const [_, year, month, day, hour, minute] = match;
                const result = hour ? 
                    `${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year} ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}` :
                    `${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}`;
                console.log(`Parsed as: ${result}`);
                return result;
            } else if (match.length >= 4) {
                // MM/DD/YYYY or DD/MM/YYYY format
                const [_, part1, part2, year, hour, minute] = match;
                const fullYear = year.length === 2 ? `20${year}` : year;
                const result = hour ? 
                    `${part2.padStart(2, '0')}-${part1.padStart(2, '0')}-${fullYear} ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}` :
                    `${part2.padStart(2, '0')}-${part1.padStart(2, '0')}-${fullYear}`;
                console.log(`Parsed as: ${result}`);
                return result;
            } else if (match.length >= 3) {
                // Time only
                const [_, hour, minute] = match;
                const result = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
                console.log(`Parsed as: ${result}`);
                return result;
            }
        }
    }
    
    console.log('Could not parse datetime');
    return '';
};

const extractDateTime = (text) => {
    const cleanedText = text.replace(/\r/g, '');
    
    // Look for various date/time patterns
    const dateTimePatterns = [
        // Date with time
        /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\b/gi,
        
        // ISO date format
        /\b(\d{4}-\d{1,2}-\d{1,2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)\b/gi,
        
        // Date only
        /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/gi,
        
        // Time only (as fallback)
        /\b(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\b/gi
    ];
    
    for (const pattern of dateTimePatterns) {
        const matches = cleanedText.match(pattern);
        if (matches && matches.length > 0) {
            // Take the first match
            const dateStr = matches[0].trim();
            const parsed = parseDateTime(dateStr);
            if (parsed) {
                console.log(`Found date/time: ${dateStr} -> ${parsed}`);
                return parsed;
            }
        }
    }
    
    console.log('No date/time found');
    return '';
};

const extractMerchantName = (text, filename) => {
    const cleanedText = text.replace(/\r/g, '');
    const lines = cleanedText.split('\n').map(line => line.trim()).filter(Boolean);
    
    console.log(`First 5 lines of OCR text:`, lines.slice(0, 5));
    
    // Extract company hint from filename
    let companyHint = '';
    const parts = filename.split('-');
    if (parts.length > 1) {
        const afterDash = parts[1];
        const match = afterDash.match(/^([a-zA-Z0-9]+)/);
        if (match) companyHint = match[1].toLowerCase();
    }
    
    console.log(`Company hint from filename: "${companyHint}"`);
    
    // Search first 5 lines for company hint match
    let companyName = '';
    for (let i = 0; i < Math.min(5, lines.length); i++) {
        const lineLower = lines[i].toLowerCase();
        if (companyHint && lineLower.includes(companyHint)) {
            companyName = lines[i];
            console.log(`Found company name via hint: "${companyName}"`);
            break;
        }
    }
    
    // If no hint match, look for business-like names in first few lines
    if (!companyName) {
        const businessPatterns = [
            // Common business suffixes
            /^[A-Za-z\s&\-.,']+(LLC|Inc|Corp|Ltd|Co\.|Company|Store|Market|Restaurant|Cafe|Shop|Pharmacy|Gas|Station|Hotel|Motel)\b/i,
            
            // Lines with common business words
            /^[A-Za-z\s&\-.,']*(Restaurant|Cafe|Coffee|Market|Store|Shop|Gas|Pharmacy|Hotel|Motel|Bar|Grill)\b/i,
            
            // Clean text lines (letters, spaces, common punctuation)
            /^[A-Za-z\s&\-.,'\(\)]{3,50}$/
        ];
        
        for (let i = 0; i < Math.min(5, lines.length); i++) {
            const line = lines[i];
            
            // Skip lines that are clearly not business names
            if (/^\d+$/.test(line) || // Just numbers
                /^[\d\s\-\(\)]+$/.test(line) || // Phone numbers
                /^[A-Z]{2,}\s+\d+/.test(line) || // State codes with numbers
                line.length < 3 || line.length > 50) {
                continue;
            }
            
            for (const pattern of businessPatterns) {
                if (pattern.test(line)) {
                    companyName = line;
                    console.log(`Found company name via pattern: "${companyName}"`);
                    break;
                }
            }
            
            if (companyName) break;
        }
    }
    
    // Final fallback - first reasonable line
    if (!companyName && lines.length > 0) {
        for (let i = 0; i < Math.min(3, lines.length); i++) {
            const line = lines[i];
            if (line.length >= 3 && line.length <= 50 && 
                /^[A-Za-z\s&\-.,'\(\)]+$/.test(line)) {
                companyName = line;
                console.log(`Using fallback company name: "${companyName}"`);
                break;
            }
        }
    }
    
    return companyName || 'Unknown Merchant';
};

const extractReceiptData = (text, filename) => {
    console.log('\n=== Starting receipt data extraction ===');
    console.log(`Filename: ${filename}`);
    console.log(`Text length: ${text.length} characters`);
    
    const companyName = extractMerchantName(text, filename);
    const date = extractDateTime(text);
    const amount = extractAmount(text);
    
    console.log('\n=== Extraction Results ===');
    console.log(`Company: "${companyName}"`);
    console.log(`Date: "${date}"`);
    console.log(`Amount: "${amount}"`);
    
    return { companyName, date, amount };
};

export const processReceipt = async (req, res) => {
    const { id } = req.params;

    try {
        // Fetch uploaded file info
        const receipt = await db.get(`SELECT * FROM uploaded_files WHERE id = ?`, [id]);

        if (!receipt) {
            return res.status(404).json({ success: false, message: 'Receipt not found' });
        }

        const pdfPath = receipt.file_path;
        console.log('Processing receipt:', receipt);

        if (!pdfPath || !(await fs.stat(pdfPath).catch(() => false))) {
            return res.status(400).json({ success: false, message: 'PDF file not found on server' });
        }

        await ensureOutputDir();

        const images = await convertPdfToImages(pdfPath);

        if (!images.length) {
            return res.status(500).json({ success: false, message: 'Failed to convert PDF to images' });
        }

        const filename = path.basename(pdfPath);
        const extractedText = await runTesseractOnImages(images);
        
        console.log('\n=== Full OCR Text ===');
        console.log(extractedText);
        console.log('=== End OCR Text ===\n');

        const receiptData = extractReceiptData(extractedText, filename);

        // Parse amount to float
        const totalAmount = receiptData.amount ? parseFloat(receiptData.amount.replace(/,/g, '')) : 0;

        // Insert extracted_receipts with more lenient validation
        const hasValidData = receiptData.companyName && 
                           receiptData.companyName !== 'Unknown Merchant' && 
                           !isNaN(totalAmount) && 
                           totalAmount > 0;

        if (hasValidData || receiptData.date || totalAmount > 0) {
            await db.run(
                `INSERT INTO extracted_receipts (purchased_at, merchant_name, total_amount, file_path) VALUES (?, ?, ?, ?)`,
                [receiptData.date || null, receiptData.companyName || 'Unknown Merchant', totalAmount || 0, pdfPath]
            );

            // Mark uploaded file as processed
            await db.run(
                `UPDATE uploaded_files SET is_processed = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [id]
            );

            return res.json({
                success: true,
                message: 'Receipt processed successfully',
                data: {
                    ...receiptData,
                    totalAmount,
                    confidence: hasValidData ? 'high' : 'partial'
                },
            });
        } else {
            return res.status(422).json({
                success: false,
                message: 'Failed to extract valid receipt data',
                data: {
                    ...receiptData,
                    totalAmount,
                    extractedText: extractedText.substring(0, 500) + '...' // Include sample for debugging
                },
            });
        }

    } catch (error) {
        console.error('❌ Error processing receipt:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
    }
};