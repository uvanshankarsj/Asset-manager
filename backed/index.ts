import express from 'express';
require('dotenv').config();
import mongoose from 'mongoose';
import cors from 'cors';
import { getamount, addExpense } from './db-operations';
import multer from 'multer';

const uri = process.env.MONGO_URI;
const credentials = process.env.MONGO_CERT_PATH;
const dbName = process.env.DB_NAME;
const app = express();
const port = process.env.PORT || 3001;

// Enable CORS for all routes
app.use(cors());

// Middleware to handle multipart/form-data
// This will parse the form fields and make them available on req.body
// It will ignore files for now.
const upload = multer();
app.use(upload.none()); // .none() because we are only handling text fields for now

if (!uri || !credentials || !dbName) {
  throw new Error('Please define MONGO_URI, MONGO_CERT_PATH, and DB_NAME in your .env file');
}

async function connectToDatabase() {
  try {
    await mongoose.connect(uri!, {
      dbName: dbName,
      tls: true,
      tlsCertificateKeyFile: credentials,
    });
    console.log('Successfully connected to MongoDB with Mongoose!');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1); // Exit the process with an error code
  }
}

app.get('/api/message', (req, res) => {
  res.json({ message: 'Hello from the backend!' });
});

app.post('/api/expenses', async (req, res) => {
  try {
    // Data is now in req.body thanks to multer
    const { category, subject, merchant, date, amount } = req.body;

    if (!category || !subject || !date || !amount) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    const expenseData = {
      category,
      subject,
      merchant: merchant || '',
      date: new Date(date),
      amount: Number(amount),
    };

    const newExpense = await addExpense(expenseData);
    return res.status(201).json({ success: true, data: newExpense });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, message: 'Server error while creating expense.' });
  }
});

app.get('/api/getamount', async (req, res) => {
  // Call the getamount function to fetch data from the DB
  const data = await getamount();
  res.json(data);
});

async function startServer() {
  await connectToDatabase();
  // The DB operations script now runs once after connection, before the server starts listening.
  app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
  });
}

startServer();
