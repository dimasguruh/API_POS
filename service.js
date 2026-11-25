const express = require('express');
const crypto = require('crypto');
const app = express();

app.use(express.json());

// Mapping kode huruf depan sesuai store_id dari data transaksi
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

// Secret/salt untuk enkripsi/hash deterministik berdasarkan variabel `nilai`
const SECRET_KEY = process.env.TX_SECRET_KEY || 'ganti-dengan-secret-key-anda';

/**
 * Menghasilkan transaction_id format UUID-like dari variabel `nilai`
 * Menggunakan HMAC-SHA256 sehingga nilai 1 dan nilai 2 menghasilkan output berbeda,
 * namun input `nilai` yang sama selalu menghasilkan ID yang konsisten.
 */
function generateTransactionId(nilai) {
  const hex = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(String(nilai))
    .digest('hex')
    .toUpperCase();

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Menghasilkan transaction_number dengan pola:
 * [kode_huruf_store_id] + "2990001" + [4 digit belakang dari `nilai`]
 * Contoh: store_id = 12, nilai = 1 -> "PL29900010001"
 */
function generateTransactionNumber(storeId, nilai) {
  const numericStoreId = Number(storeId);
  const prefix = storePrefixMap[numericStoreId] || `ST${numericStoreId}`;
  const numericNilai = Math.abs(Number(nilai));
  const fourDigits = String(numericNilai).padStart(4, '0').slice(-4);

  return `${prefix}2990001${fourDigits}`;
}

const transactions = [];

app.post('/api/transactions/generate', (req, res) => {
  const {
    nilai,
    customer_id,
    store_id,
    sales_associate_id,
    transaction_date,
    total_amount,
  } = req.body;

  if (nilai === undefined || nilai === null || String(nilai).trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Variabel `nilai` wajib dikirimkan.',
    });
  }

  if (!customer_id || !store_id || total_amount === undefined) {
    return res.status(400).json({
      success: false,
      message: 'customer_id, store_id, dan total_amount wajib diisi.',
    });
  }

  const transaction_id = generateTransactionId(nilai);
  const transaction_number = generateTransactionNumber(store_id, nilai);

  const newTransaction = {
    transaction_id,
    customer_id: String(customer_id).trim().toUpperCase(),
    store_id: Number(store_id),
    sales_associate_id: Number(sales_associate_id) || 0,
    transaction_number,
    transaction_date: transaction_date || new Date().toISOString(),
    total_amount: Number(total_amount),
  };

  transactions.push(newTransaction);

  return res.status(201).json({
    success: true,
    message: 'Transaksi berhasil di-generate.',
    data: newTransaction,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});