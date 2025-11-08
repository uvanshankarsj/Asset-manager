import mongoose from 'mongoose';

const CATEGORIES = ['FD', 'Share', 'Mutual Fund'];

const userSchema = new mongoose.Schema({
    category: { type: String, required: true, unique: true, enum: CATEGORIES },
    amount: { type: Number, min: 0 },
});
const User = mongoose.models.User || mongoose.model('User', userSchema);

export async function getamount(category: string) {
    try {
        // Find a user using the model
        const foundUser = await User.findOne({ category: category });
        console.log('Found user:', foundUser);

    } catch (error) {
        console.error("An error occurred during DB operations:", error);
    }
}

export async function updateAmount(category: string, amountToAdd: number) {
    try {
        console.log(`\nUpdating amount for category: '${category}'...`);
        const updateResult = await User.updateOne(
            { category: category }, // Filter to find the document
            { $set: { amount: amountToAdd } } // The update operation
        );
        console.log('Update result:', updateResult);

        // Verify the update
        const updatedUser = await User.findOne({ category: category });
        console.log('Updated user:', updatedUser);
        console.log('Updated amount:', updatedUser?.amount);
    } catch (error) {
        console.error("An error occurred while updating amount:", error);
    }
}