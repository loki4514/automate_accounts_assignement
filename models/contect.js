import sqlite3 from 'sqlite3';

export const db = new sqlite3.Database('./receipts.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database.');
    }
});
