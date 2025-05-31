import express from 'express'
import { uploadPdf } from '../services/upload_invoice.js'
import { getAllReceipts, getReceiptById } from '../services/get_invoice.js'
import { processReceipt } from '../services/process_invoice.js'
const router = express.Router()


router.post("/upload", uploadPdf )
router.get("/receipts", getAllReceipts)
router.get('/receipts/:id', getReceiptById);
router.post("/process/:id", processReceipt)


export default router