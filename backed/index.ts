import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import { initDatabase, getamount, addExpense, getRecentExpenses, getPendingActions, deleteMaturedFD, markSipPaid, getRecentActivity, getAssets, addAsset, deleteAsset, getInvestments, getAllActivity, deleteInvestment, getSharePrices, searchStocks, updateAsset, updateInvestment } from './db-operations';
import multer from 'multer';
import { authRouter, requireAuth } from './auth';
import { getMongoUri, getConnectOptions, explainConnectionError } from './db-config';

const app = express();
const port = process.env.PORT || 3001;

// Enable CORS for all routes
app.use(cors());

// Middleware to handle multipart/form-data
// This will parse the form fields and make them available on req.body
// It will ignore files for now.
const upload = multer();
app.use(upload.none()); // .none() because we are only handling text fields for now
app.use(express.json({ limit: '300kb' })); // login and register send JSON

// Login and register are open. Every other /api route needs a valid token.
app.use('/api/auth', authRouter);
app.use('/api', requireAuth);

async function connectToDatabase() {
  try {
    await mongoose.connect(getMongoUri(), getConnectOptions());
    // Create the collections if this is a brand new database
    await initDatabase();
    console.log(`Connected to MongoDB database "${mongoose.connection.name}".`);
  } catch (error) {
    console.error(explainConnectionError(error));
    process.exit(1);
  }
}

app.get('/api/message', (req, res) => {
  res.json({ message: 'Hello from the backend!' });
});

app.post('/api/expenses', async (req, res) => {
  try {
    // Data is now in req.body thanks to multer
    const { category, subject, merchant, symbol, quantity, pricePerShare, date, amount, maturityDate, nextSipDate } = req.body;

    // Shares are entered as quantity x price per share, so they don't send a total amount
    const isShareLot = Number(quantity) > 0 && Number(pricePerShare) > 0;
    if (!category || !subject || !date || (!amount && !isShareLot)) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    const expenseData = {
      category,
      subject,
      merchant: merchant || '',
      ...(symbol && { symbol: String(symbol).trim().toUpperCase() }),
      date: new Date(date),
      amount: Number(amount),
      ...(isShareLot && { quantity: Number(quantity), pricePerShare: Number(pricePerShare) }),
      ...(maturityDate && { maturityDate: new Date(maturityDate) }),
      ...(nextSipDate && { nextSipDate: new Date(nextSipDate) }),
    };

    const newExpense = await addExpense(req.userId!, expenseData);
    return res.status(201).json({ success: true, data: newExpense });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, message: 'Server error while creating expense.' });
  }
});

app.get('/api/getamount', async (req, res) => {
  // Call the getamount function to fetch data from the DB
  const data = await getamount(req.userId!);
  res.json(data);
});

app.get('/api/expenses/recent', async (req, res) => {
  try {
    res.json(await getRecentExpenses(req.userId!));
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching expenses.' });
  }
});

app.get('/api/pending-actions', async (req, res) => {
  try {
    res.json(await getPendingActions(req.userId!));
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching pending actions.' });
  }
});

app.delete('/api/expenses/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid id.' });
    }
    // Only matured FDs can be deleted
    const deleted = await deleteMaturedFD(req.userId!, req.params.id);
    if (!deleted) {
      return res.status(409).json({ success: false, message: 'Not a matured FD.' });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, message: 'Server error while deleting FD.' });
  }
});

app.post('/api/expenses/:id/sip-paid', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid id.' });
    }
    const nextSipDate = await markSipPaid(req.userId!, req.params.id);
    if (!nextSipDate) {
      return res.status(409).json({ success: false, message: 'No SIP instalment due.' });
    }
    return res.json({ success: true, nextSipDate });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, message: 'Server error while updating SIP.' });
  }
});

app.get('/api/activity/recent', async (req, res) => {
  try {
    res.json(await getRecentActivity(req.userId!));
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching activity.' });
  }
});

app.get('/api/assets', async (req, res) => {
  try {
    res.json(await getAssets(req.userId!));
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching assets.' });
  }
});

app.post('/api/assets', async (req, res) => {
  try {
    const { name, price, purchaseDate } = req.body;
    if (!name || price === undefined || price === '' || !purchaseDate) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }
    const asset = await addAsset(req.userId!, { name, price: Number(price), purchaseDate: new Date(purchaseDate) });
    return res.status(201).json({ success: true, data: asset });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, message: 'Server error while creating asset.' });
  }
});

app.put('/api/assets/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid id.' });
    }
    const { name, price, purchaseDate } = req.body;
    if (!String(name ?? '').trim() || price === undefined || price === '' || !purchaseDate) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }
    if (!(Number(price) >= 0) || isNaN(new Date(purchaseDate).getTime())) {
      return res.status(400).json({ success: false, message: 'Enter a valid price and date.' });
    }
    const asset = await updateAsset(req.userId!, req.params.id, {
      name: String(name).trim(),
      price: Number(price),
      purchaseDate: new Date(purchaseDate),
    });
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found.' });
    }
    return res.json({ success: true, data: asset });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, message: 'Server error while updating asset.' });
  }
});

app.delete('/api/assets/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid id.' });
    }
    const deleted = await deleteAsset(req.userId!, req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Asset not found.' });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, message: 'Server error while deleting asset.' });
  }
});

app.get('/api/investments', async (req, res) => {
  try {
    res.json(await getInvestments(req.userId!));
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching investments.' });
  }
});

app.get('/api/investments/prices', async (req, res) => {
  try {
    res.json(await getSharePrices(req.userId!));
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching share prices.' });
  }
});

app.get('/api/stocks/search', async (req, res) => {
  res.json(await searchStocks(String(req.query.q ?? '')));
});

app.put('/api/investments/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid id.' });
    }
    const { subject, date, amount, symbol, quantity, pricePerShare, maturityDate, nextSipDate } = req.body;
    const bad = (message: string) => res.status(400).json({ success: false, message });
    if (!String(subject ?? '').trim() || !date) return bad('Name and date are required.');
    const toDate = (v: unknown) => (v ? new Date(String(v)) : null);
    const dates = [toDate(date), toDate(maturityDate), toDate(nextSipDate)];
    if (dates.some((d) => d && isNaN(d.getTime()))) return bad('Enter valid dates.');
    const num = (v: unknown) => (v === undefined || v === '' ? undefined : Number(v));
    const [amt, qty, price] = [num(amount), num(quantity), num(pricePerShare)];
    if ([amt, qty, price].some((n) => n !== undefined && !(n >= 0))) return bad('Amounts must be zero or more.');

    const result = await updateInvestment(req.userId!, req.params.id, {
      subject: String(subject).trim(),
      date: dates[0]!,
      amount: amt,
      quantity: qty,
      pricePerShare: price,
      symbol: symbol ? String(symbol).trim().toUpperCase() : undefined,
      maturityDate: dates[1],
      nextSipDate: dates[2],
    });
    if (!result) return res.status(404).json({ success: false, message: 'Investment not found.' });
    if ('error' in result) return bad(result.error);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, message: 'Server error while updating investment.' });
  }
});

app.delete('/api/investments/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid id.' });
    }
    if (!(await deleteInvestment(req.userId!, req.params.id))) {
      return res.status(404).json({ success: false, message: 'Investment not found.' });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, message: 'Server error while deleting investment.' });
  }
});

app.get('/api/activity/all', async (req, res) => {
  try {
    res.json(await getAllActivity(req.userId!));
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching activity.' });
  }
});

async function startServer() {
  await connectToDatabase();
  // The DB operations script now runs once after connection, before the server starts listening.
  app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
  });
}

startServer();
