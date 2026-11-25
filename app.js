const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const SECRET_KEY = 'API_POS'

const storePrefixMap = {
  12: 'PL',
  17: 'FS',
  14: 'UD',
  16: 'KJ',
  15: 'CB',
  31: 'GN',
  13: 'SR',
  18: 'ECOM',
  25: 'LN',
  19: 'BB',
};

function encryptTransactionId(nilai) {
  return crypto
    .createHmac('sha256', SECRET_KEY)
    .update(String(nilai))
    .digest('hex')
    .toUpperCase();
}

function buildTransactionNumber(storeId, nilai) {
  const numericStoreId = Number(storeId);
  const prefix = storePrefixMap[numericStoreId] || `ST${numericStoreId}`;
  const fourDigits = String(Math.abs(Number(nilai))).padStart(4, '0').slice(-4);
  return `${prefix}2990001${fourDigits}`;
}

function parseCsvSemicolon(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  const lines = raw.split(/\r?\n/);
  const headers = lines[0].split(';').map((h) => h.trim());

  return lines.slice(1).filter(Boolean).map((line) => {
    const cols = line.split(';');
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] !== undefined ? cols[idx].trim() : '';
    });
    return row;
  });
}

const baseTransactions = parseCsvSemicolon(
  path.join(__dirname, 'sample_transaksi_100.csv')
).map((row) => ({
  original_transaction_id: row.transaction_id.toUpperCase(),
  customer_id: row.customer_id,
  store_id: Number(row.store_id),
  sales_associate_id: Number(row.sales_associate_id),
  transaction_date: row.transaction_date,
  total_amount: Number(row.total_amount),
}));

const targetTxIdSet = new Set(
  baseTransactions.map((t) => t.original_transaction_id)
);


const baseTransactionItems = parseCsvSemicolon(
  path.join(__dirname, 'transaction_item.csv')
)
  .filter((row) => targetTxIdSet.has(row.transaction_id.toUpperCase()))
  .map((row) => ({
    item_id: row.item_id,
    original_transaction_id: row.transaction_id.toUpperCase(),
    variant_id: row.variant_id,
    quantity: Number(row.quantity),
    unit_price: Number(row.unit_price),
    subtotal: Number(row.subtotal),
  }));


app.post('/api/transactions', (req, res) => {
  const startNilai =
    req.body && req.body.nilai !== undefined ? Number(req.body.nilai) : 1;

  if (Number.isNaN(startNilai)) {
    return res.status(400).json({
      success: false,
      message: 'Nilai harus berupa angka.',
    });
  }

  // Map original_transaction_id -> transaction_id baru hasil enkripsi
  const txIdMapping = new Map();

  const generatedTransactions = baseTransactions.map((item, index) => {
    const currentNilai = startNilai + index;
    const newTxId = encryptTransactionId(currentNilai);

    txIdMapping.set(item.original_transaction_id, newTxId);

    return {
      id: currentNilai,
      transaction_id: newTxId,
      customer_id: item.customer_id,
      store_id: item.store_id,
      sales_associate_id: item.sales_associate_id,
      transaction_number: buildTransactionNumber(item.store_id, currentNilai),
      transaction_date: item.transaction_date,
      total_amount: item.total_amount,
    };
  });

  const generatedItems = baseTransactionItems.map((item) => ({
    item_id: item.item_id,
    transaction_id: txIdMapping.get(item.original_transaction_id),
    variant_id: item.variant_id,
    quantity: item.quantity,
    unit_price: item.unit_price,
    subtotal: item.subtotal,
  }));

  return res.status(200).json({
    success: true,
    total_transactions: generatedTransactions.length,
    total_items: generatedItems.length,
    transactions: generatedTransactions,
    transaction_items: generatedItems,
  });
});

app.listen(3000, ()=> {
    console.log('run')
})