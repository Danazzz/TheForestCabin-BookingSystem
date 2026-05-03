const mongoose = require("mongoose");

const transactionUnsupportedMessages = [
  "Transaction numbers are only allowed",
  "This MongoDB deployment does not support retryable writes",
  "transactions are not supported"
];

const isTransactionUnsupported = (error) => {
  const message = String(error.message || "").toLowerCase();
  return transactionUnsupportedMessages.some((item) =>
    message.includes(item.toLowerCase())
  );
};

const runWithOptionalTransaction = async (work) => {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      result = await work(session);
    });

    return result;
  } catch (error) {
    if (isTransactionUnsupported(error)) {
      return work(null);
    }

    throw error;
  } finally {
    await session.endSession();
  }
};

module.exports = runWithOptionalTransaction;
