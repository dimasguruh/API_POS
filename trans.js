const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const SECRET_KEY = 'POS_API'

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

function loadBaseTransactionsFromCsv() {
  const csvPath = path.join(__dirname, 'sample_transaksi_100.csv');
  const raw = fs.readFileSync(csvPath, 'utf8').trim();
  const lines = raw.split(/\r?\n/);
  const headers = lines[0].split(';');

  return lines.slice(1).filter(Boolean).map((line) => {
    const cols = line.split(';');
    const row = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = cols[idx] ? cols[idx].trim() : '';
    });

    return {
      customer_id: row.customer_id,
      store_id: Number(row.store_id),
      sales_associate_id: Number(row.sales_associate_id),
      transaction_date: row.transaction_date,
      total_amount: Number(row.total_amount),
    };
  });
}

const baseTransactions = loadBaseTransactionsFromCsv();


app.post('/api/transactions', (req, res) => {
  const startNilai = req.body && req.body.nilai !== undefined
    ? Number(req.body.nilai)
    : 1;

  if (Number.isNaN(startNilai)) {
    return res.status(400).json({
      success: false,
      message: 'Nilai harus berupa angka.',
    });
  }

  const generatedData = baseTransactions.map((item, index) => {
    const currentNilai = startNilai + index;

    return {
      nilai: currentNilai,
      transaction_id: encryptTransactionId(currentNilai),
      customer_id: item.customer_id,
      store_id: item.store_id,
      sales_associate_id: item.sales_associate_id,
      transaction_number: buildTransactionNumber(item.store_id, currentNilai),
      transaction_date: item.transaction_date,
      total_amount: item.total_amount,
    };
  });

  return res.status(200).json({
    success: true,
    total_data: generatedData.length,
    start_nilai: startNilai,
    end_nilai: startNilai + generatedData.length - 1,
    data: generatedData,
  });
});


app.listen(3000, ()=> {
    console.log('run')
})