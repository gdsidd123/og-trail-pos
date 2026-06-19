const fs = require('fs');
const path = require('path');

const inputPath = process.argv[2] || path.join(process.cwd(), 'customer-qr-tokens.json');
const outputPath = process.argv[3] || path.join(process.cwd(), 'outputs', 'customer-qr-codes.html');

if (!fs.existsSync(inputPath)) {
  console.error(`Missing input file: ${inputPath}`);
  console.error('Expected JSON: [{ "tableName": "Table 1", "url": "https://order.example.com/t/raw-token" }]');
  process.exit(1);
}

const rows = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
if (!Array.isArray(rows) || rows.length === 0) {
  console.error('Input JSON must be a non-empty array.');
  process.exit(1);
}

const cards = rows.map((row) => {
  const tableName = row.tableName || row.name || row.table_id || 'Table';
  const url = row.url;
  if (!url) throw new Error(`Missing url for ${tableName}`);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(url)}`;
  return `
    <section class="card">
      <h2>${escapeHtml(tableName)}</h2>
      <img src="${qrUrl}" alt="${escapeHtml(tableName)} QR" />
      <p>Scan to order</p>
      <small>${escapeHtml(url)}</small>
    </section>
  `;
}).join('\n');

const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Customer QR Codes</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
      main { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
      .card { border: 1px solid #ddd; border-radius: 8px; padding: 18px; text-align: center; page-break-inside: avoid; }
      h2 { margin: 0 0 12px; font-size: 24px; }
      img { width: 260px; height: 260px; }
      p { margin: 10px 0 6px; font-weight: 700; }
      small { display: block; overflow-wrap: anywhere; color: #666; }
      @media print { body { margin: 12mm; } .card { break-inside: avoid; } }
    </style>
  </head>
  <body>
    <main>${cards}</main>
  </body>
</html>`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, html);
console.log(`Wrote ${outputPath}`);

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
