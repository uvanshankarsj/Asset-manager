import mongoose from 'mongoose';

// Every record belongs to the user who created it. Queries must always filter by it.
const owner = { type: mongoose.Schema.Types.ObjectId, ref: 'AuthUser', required: true, index: true };
const oid = (userId: string) => new mongoose.Types.ObjectId(userId);

const CATEGORIES = ['FD', 'share', 'Mutual Funds', 'Other'];

const CATEGORY_ALIASES: Record<string, string> = {
    fd: 'FD',
    'fixed deposit': 'FD',
    share: 'share',
    shares: 'share',
    'mutual fund': 'Mutual Funds',
    'mutual funds': 'Mutual Funds',
};

export function normalizeCategory(raw: string): string {
    const key = String(raw ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
    return CATEGORY_ALIASES[key] ?? 'Other';
}

interface ITransaction {
    userId?: string;
    category: string;
    amount: number;
    date: Date;
    subject: string;
    merchant?: string;
    symbol?: string;
    quantity?: number; // shares held (share category only)
    pricePerShare?: number; // average buy price per share
    attachment?: string;
    maturityDate?: Date;
    nextSipDate?: Date;
}

const userSchema = new mongoose.Schema({
    userId: owner,
    category: { type: String, required: true, enum: CATEGORIES },
    amount: { type: Number, min: 0 },
    date: { type: Date, default: Date.now },
    subject: { type: String, required: true },
    merchant: { type: String },
    symbol: { type: String }, // ticker used to look up the live share price (e.g. RELIANCE.NS)
    quantity: { type: Number, min: 0 },
    pricePerShare: { type: Number, min: 0 },
    attachment: { type: String },
    maturityDate: { type: Date }, // FD maturity
    nextSipDate: { type: Date } // next SIP instalment (Mutual Funds)
});
const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', userSchema);

export type ActivityType = 'NEW_FD' | 'SIP_STARTED' | 'FD_CLOSED' | 'SIP_PAID' | 'ADDED';

// Log of actions taken by the user. Stores a snapshot so it survives deletion of the source record.
const activitySchema = new mongoose.Schema({
    userId: owner,
    type: { type: String, required: true, enum: ['NEW_FD', 'SIP_STARTED', 'FD_CLOSED', 'SIP_PAID', 'ADDED'] },
    subject: { type: String, required: true },
    category: { type: String },
    amount: { type: Number },
    date: { type: Date, default: Date.now }
});
const Activity = mongoose.models.Activity || mongoose.model('Activity', activitySchema);

// A failed log write must never fail the action that triggered it
async function logActivity(userId: string, type: ActivityType, subject: string, category: string, amount?: number) {
    try {
        await Activity.create({ userId, type, subject, category, amount });
    } catch (error) {
        console.error('Could not write activity log:', error);
    }
}

export async function getRecentActivity(userId: string, limit = 8) {
    return Activity.find({ userId }, 'type subject amount date').sort({ date: -1 }).limit(limit).lean();
}

export async function getamount(userId: string) {
    try {
        // Find all documents in the User collection
        // const users = await User.find({});
        // return users;

        const raw: { _id: string; totalSpent: number }[] = await Transaction.aggregate([
            { $match: { userId: oid(userId) } },
            { $group: { _id: '$category', totalSpent: { $sum: '$amount' } } },
        ]);

        // Merge legacy/variant category names (e.g. "Share" and "share") into one bucket
        const merged = new Map<string, number>();
        for (const { _id, totalSpent } of raw) {
            const category = normalizeCategory(_id);
            merged.set(category, (merged.get(category) ?? 0) + totalSpent);
        }
        const summary = [...merged]
            .map(([_id, totalSpent]) => ({ _id, totalSpent }))
            .sort((a, b) => b.totalSpent - a.totalSpent);
        console.log("Aggregated summary:", summary);

        return summary;
        // json(summary);
    } catch (error) {
        console.error("An error occurred during DB operations:", error);
        throw error; // Re-throw the error to be handled by the API route
    }
}

export async function getRecentExpenses(userId: string, limit = 4) {
    return Transaction.find({ userId }, 'subject amount date').sort({ date: -1 }).limit(limit).lean();
}

// Creates the collections (and indexes) if they don't exist yet, so a new database works out of the box
export async function initDatabase() {
    await Promise.all([Transaction.init(), Activity.init()]);
}

export type PendingAction = {
    _id: string;
    type: 'FD_MATURITY' | 'SIP_DUE';
    subject: string;
    amount: number;
    date: Date;
};

type LeanTransaction = {
    _id: unknown;
    subject: string;
    amount: number;
    maturityDate: Date;
    nextSipDate: Date;
};

export async function getPendingActions(userId: string, limit = 5): Promise<PendingAction[]> {
    const [fds, sips] = (await Promise.all([
        Transaction.find({ userId, category: 'FD', maturityDate: { $ne: null } }, 'subject amount maturityDate')
            .sort({ maturityDate: 1 }).limit(limit).lean(),
        Transaction.find({ userId, category: 'Mutual Funds', nextSipDate: { $ne: null } }, 'subject amount nextSipDate')
            .sort({ nextSipDate: 1 }).limit(limit).lean(),
    ])) as unknown as LeanTransaction[][];
    return [
        ...fds.map((d) => ({ _id: String(d._id), type: 'FD_MATURITY' as const, subject: d.subject, amount: d.amount, date: d.maturityDate })),
        ...sips.map((d) => ({ _id: String(d._id), type: 'SIP_DUE' as const, subject: d.subject, amount: d.amount, date: d.nextSipDate })),
    ]
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .slice(0, limit);
}

// Add whole months in UTC, clamping to the last day of the target month (31 Jan -> 28 Feb)
function addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    const day = result.getUTCDate();
    result.setUTCDate(1);
    result.setUTCMonth(result.getUTCMonth() + months);
    const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
    result.setUTCDate(Math.min(day, lastDay));
    return result;
}

// Deletes an FD only if it has reached its maturity date. Returns false if nothing was deleted.
export async function deleteMaturedFD(userId: string, id: string): Promise<boolean> {
    const deleted = await Transaction.findOneAndDelete({
        _id: id,
        userId,
        category: 'FD',
        maturityDate: { $lte: new Date() },
    });
    if (deleted) await logActivity(userId, 'FD_CLOSED', deleted.subject, 'FD', deleted.amount);
    return deleted !== null;
}

// Marks the current SIP instalment as paid by moving nextSipDate forward one month.
// Returns the new date, or null if the record isn't a SIP whose instalment is due.
export async function markSipPaid(userId: string, id: string): Promise<Date | null> {
    const sip = await Transaction.findOne({
        _id: id,
        userId,
        category: 'Mutual Funds',
        nextSipDate: { $lte: new Date() },
    });
    if (!sip) return null;
    sip.nextSipDate = addMonths(sip.nextSipDate, 1);
    await sip.save();
    // Record the instalment as an investment so portfolio totals reflect what has been paid.
    // It has no nextSipDate, so it never shows up in Pending Actions.
    await Transaction.create({
        userId,
        category: 'Mutual Funds',
        subject: `${sip.subject} (SIP instalment)`,
        amount: sip.amount,
        date: new Date(),
    });
    await logActivity(userId, 'SIP_PAID', sip.subject, 'Mutual Funds', sip.amount);
    return sip.nextSipDate;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Buying more of a share you already hold merges into that holding and averages the buy price.
// A holding matches on ticker when there is one, otherwise on name. Holdings saved before
// quantities existed have no quantity to average against, so they are never merged into.
async function addToShareHolding(data: ITransaction & { quantity: number; pricePerShare: number }) {
    const holding = await Transaction.findOne({
        userId: data.userId,
        category: 'share',
        quantity: { $gt: 0 },
        ...(data.symbol
            ? { symbol: data.symbol }
            : { subject: new RegExp(`^${data.subject.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }),
    });
    const cost = round2(data.quantity * data.pricePerShare);
    if (!holding) {
        return Transaction.create({ ...data, category: 'share', amount: cost });
    }
    holding.quantity += data.quantity;
    holding.amount = round2(holding.amount + cost);
    holding.pricePerShare = round2(holding.amount / holding.quantity);
    if (data.symbol && !holding.symbol) holding.symbol = data.symbol;
    await holding.save();
    return holding;
}

export async function addExpense(userId: string, input: ITransaction) {
    const expenseData = { ...input, userId };
    try {
        console.log("Creating new expense with data:", expenseData);
        if (
            normalizeCategory(expenseData.category) === 'share' &&
            expenseData.quantity && expenseData.pricePerShare
        ) {
            const share = await addToShareHolding(expenseData as ITransaction & { quantity: number; pricePerShare: number });
            await logActivity(userId, 'ADDED', share.subject, 'share', round2(expenseData.quantity * expenseData.pricePerShare));
            return share;
        }
        const newExpense = new Transaction({
            ...expenseData,
            category: normalizeCategory(expenseData.category),
        });
        await newExpense.save();
        await logActivity(
            userId,
            newExpense.category === 'FD'
                ? 'NEW_FD'
                : newExpense.category === 'Mutual Funds' && newExpense.nextSipDate
                    ? 'SIP_STARTED'
                    : 'ADDED',
            newExpense.subject,
            newExpense.category,
            newExpense.amount,
        );
        return newExpense;
    } catch (error) {
        console.error("An error occurred while adding the expense:", error);
        throw error; // Re-throw the error to be handled by the API route
    }
}

export async function updateAmount(category: string, amountToAdd: number) {
    try {
        console.log(`Updating amount for category: '${category}'...`);
        const updateResult = await Transaction.updateOne(
            { category: category }, // Filter to find the document
            { $set: { amount: amountToAdd } } // The update operation
        );
        console.log('Update result:', updateResult);

        // Verify the update
        const updatedUser = await Transaction.findOne({ category: category });
        console.log('Updated user:', updatedUser);
        console.log('Updated amount:', updatedUser?.amount);
    } catch (error) {
        console.error("An error occurred while updating amount:", error);
    }
}
// Personal assets (things the user owns)
const assetSchema = new mongoose.Schema({
    userId: owner,
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    purchaseDate: { type: Date, required: true }
});
const Asset = mongoose.models.Asset || mongoose.model('Asset', assetSchema);

export async function getAssets(userId: string) {
    return Asset.find({ userId }).sort({ purchaseDate: -1 }).lean();
}

export async function addAsset(userId: string, data: { name: string; price: number; purchaseDate: Date }) {
    return Asset.create({ ...data, userId });
}

export async function updateAsset(userId: string, id: string, data: { name: string; price: number; purchaseDate: Date }) {
    return Asset.findOneAndUpdate({ _id: id, userId }, data, { new: true, runValidators: true });
}

export async function deleteAsset(userId: string, id: string): Promise<boolean> {
    const deleted = await Asset.findOneAndDelete({ _id: id, userId });
    return deleted !== null;
}

// Investments are the transactions that are not plain "Other" expenses
const INVESTMENT_CATEGORIES = ['FD', 'Mutual Funds', 'share'];

export async function getInvestments(userId: string) {
    return Transaction.find(
        { userId, category: { $in: INVESTMENT_CATEGORIES } },
        'category subject merchant symbol quantity pricePerShare amount date maturityDate nextSipDate'
    ).sort({ date: -1 }).lean();
}

export async function getAllActivity(userId: string, limit = 100) {
    return getRecentActivity(userId, limit);
}

export type InvestmentEdit = {
    subject: string;
    date: Date;
    amount?: number;
    symbol?: string;
    quantity?: number;
    pricePerShare?: number;
    maturityDate?: Date | null;
    nextSipDate?: Date | null;
};

// Edits an investment in place. The type (FD / Mutual Funds / share) cannot be changed.
// Returns null if the record isn't this user's, or { error } if the values don't fit its type.
export async function updateInvestment(userId: string, id: string, edit: InvestmentEdit) {
    const doc = await Transaction.findOne({ _id: id, userId, category: { $in: INVESTMENT_CATEGORIES } });
    if (!doc) return null;
    const oldSubject: string = doc.subject;

    if (doc.category === 'share' && edit.quantity && edit.pricePerShare) {
        // Shares are quantity x average price, so the invested amount follows from them
        doc.quantity = edit.quantity;
        doc.pricePerShare = edit.pricePerShare;
        doc.amount = round2(edit.quantity * edit.pricePerShare);
    } else {
        if (edit.amount === undefined) return { error: 'Amount is required.' };
        doc.amount = edit.amount;
        // Keep a holding's price consistent with its amount if the quantity is known
        if (doc.category === 'share' && doc.quantity > 0) doc.pricePerShare = round2(edit.amount / doc.quantity);
    }
    doc.subject = edit.subject;
    doc.date = edit.date;
    if (doc.category === 'share') doc.symbol = edit.symbol || undefined;
    if (doc.category === 'FD') doc.maturityDate = edit.maturityDate ?? undefined;
    if (doc.category === 'Mutual Funds') doc.nextSipDate = edit.nextSipDate ?? undefined;
    await doc.save();

    // Paid SIP instalments are stored as separate rows named after the SIP, so they follow a rename
    if (doc.category === 'Mutual Funds' && oldSubject !== doc.subject) {
        await Transaction.updateMany(
            { userId, category: 'Mutual Funds', subject: `${oldSubject} (SIP instalment)` },
            { $set: { subject: `${doc.subject} (SIP instalment)` } }
        );
    }
    return doc;
}

// Removes an investment of any kind (an FD can be closed before maturity). Returns false if not found.
export async function deleteInvestment(userId: string, id: string): Promise<boolean> {
    const deleted = await Transaction.findOneAndDelete({ _id: id, userId, category: { $in: INVESTMENT_CATEGORIES } });
    if (deleted?.category === 'FD') await logActivity(userId, 'FD_CLOSED', deleted.subject, 'FD', deleted.amount);
    return deleted !== null;
}

// Live share prices from Yahoo Finance's public chart endpoint (no API key needed)
export type ShareQuote = { price: number; currency: string };
const QUOTE_TTL_MS = 60 * 1000;
const quoteCache = new Map<string, { at: number; quote: ShareQuote | null }>();

async function fetchQuote(symbol: string): Promise<ShareQuote | null> {
    const cached = quoteCache.get(symbol);
    if (cached && Date.now() - cached.at < QUOTE_TTL_MS) return cached.quote;
    let quote: ShareQuote | null = null;
    try {
        const res = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
            { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) }
        );
        if (res.ok) {
            const meta = (await res.json())?.chart?.result?.[0]?.meta;
            if (typeof meta?.regularMarketPrice === 'number') {
                quote = { price: meta.regularMarketPrice, currency: meta.currency ?? '' };
            }
        }
    } catch (error) {
        console.error(`Could not fetch quote for ${symbol}:`, error);
    }
    quoteCache.set(symbol, { at: Date.now(), quote });
    return quote;
}

// Current price for every share that has a ticker, keyed by the investment id
export async function getSharePrices(userId: string): Promise<Record<string, ShareQuote>> {
    const shares = (await Transaction.find({ userId, category: 'share', symbol: { $nin: [null, ''] } }, 'symbol').lean()) as unknown as { _id: unknown; symbol: string }[];
    const prices: Record<string, ShareQuote> = {};
    await Promise.all(shares.map(async (s) => {
        const quote = await fetchQuote(s.symbol);
        if (quote) prices[String(s._id)] = quote;
    }));
    return prices;
}

export type StockSuggestion = { symbol: string; name: string; exchange: string };

// Ticker autocomplete: search Yahoo Finance by company name or symbol
export async function searchStocks(query: string): Promise<StockSuggestion[]> {
    const q = query.trim();
    if (!q) return [];
    try {
        const res = await fetch(
            `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0&listsCount=0`,
            { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) }
        );
        if (!res.ok) return [];
        const quotes: { symbol?: string; shortname?: string; longname?: string; exchDisp?: string; quoteType?: string }[] =
            (await res.json())?.quotes ?? [];
        return quotes
            .filter((x) => x.symbol && (x.quoteType === 'EQUITY' || x.quoteType === 'ETF'))
            .map((x) => ({
                symbol: x.symbol as string,
                name: x.longname || x.shortname || (x.symbol as string),
                exchange: x.exchDisp ?? '',
            }));
    } catch (error) {
        console.error(`Could not search stocks for "${q}":`, error);
        return [];
    }
}
