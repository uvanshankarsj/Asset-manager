import express from 'express';
require('dotenv').config();
import mongoose from 'mongoose';
import { getamount, updateAmount } from './db-operations';

const uri = process.env.MONGO_URI;
const credentials = process.env.MONGO_CERT_PATH;
const dbName = process.env.DB_NAME;
const app = express();
const port = process.env.PORT || 3001;

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

app.get('/api/Updateamount', async (req, res) => {
  const { category, amount } = req.query;

  if (typeof category !== 'string' || !amount) {
    return res.status(400).json({ message: 'Both "category" and "amount" are required query parameters.' });
  }

  const amountNumber = Number(amount);
  if (isNaN(amountNumber)) {
    return res.status(400).json({ message: 'The "amount" parameter must be a valid number.' });
  }

  await updateAmount(category, amountNumber);
  res.json({
    message: `Successfully triggered update for category '${category}'. Check server logs for details.`
  });
});

app.get('/api/getamount', async (req, res) => {
  const category = req.query.category;

  if (typeof category !== 'string') {
    return res.status(400).json({ message: 'The "category" parameter must be a valid string.' });
  }

  await getamount(category);
  res.json({ message: 'Database operations performed. Check server logs for details.' });
});

async function startServer() {
  await connectToDatabase();
  // The DB operations script now runs once after connection, before the server starts listening.
  app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
  });
}

startServer();
