import mongoose from 'mongoose';

const CATEGORIES = ['FD', 'share', 'Mutual Funds', 'Other'];

interface ITransaction {
    category: string;
    amount: number;
    date: Date;
    subject: string;
    merchant?: string;
    attachment?: string;
}

const userSchema = new mongoose.Schema({
    category: { type: String, required: true, enum: CATEGORIES },
    amount: { type: Number, min: 0 },
    date: { type: Date, default: Date.now },
    subject: { type: String, required: true },
    merchant: { type: String },
    attachment: { type: String }
});
const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', userSchema);

export async function getamount() {
    try {
        // Find all documents in the User collection
        // const users = await User.find({});
        // return users;

        const summary = await Transaction.aggregate([
            {
                $group: {
                    _id: '$category',
                    totalSpent: { $sum: '$amount' }
                }
            },
            // Sort the results by totalSpent descending
            { $sort: { totalSpent: -1 } }
        ]);
        console.log("Aggregated summary:", summary);

        return summary;
        // json(summary);
    } catch (error) {
        console.error("An error occurred during DB operations:", error);
        throw error; // Re-throw the error to be handled by the API route
    }
}

export async function addExpense(expenseData: ITransaction) {
    try {
        console.log("Creating new expense with data:", expenseData);
        const newExpense = new Transaction(expenseData);
        await newExpense.save();
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