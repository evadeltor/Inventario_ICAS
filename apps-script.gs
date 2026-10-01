// Inventario PCB — backend en Google Sheets
// Pegar en Extensiones > Apps Script de la hoja, guardar e Implementar > Nueva implementación > Aplicación web
// (Ejecutar como: Yo · Quién tiene acceso: Cualquier usuario). Copiar la URL /exec en la app.
const INV = 'Inventario', LOG = 'Historial';
const IH = ['referencia', 'fabricante', 'tipo', 'valor', 'encapsulado', 'tolerancia', 'cantidad', 'ubicacion', 'actualizado'];
const LH = ['fecha', 'usuario', 'movimiento', 'referencia', 'uds', 'stock_tras'];

function sh(name, head) {
  const ss = SpreadsheetApp.getActive();
  let s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    s.appendRow(head);
    s.setFrozenRows(1);
    s.getRange(1, 1, 1, head.length).setFontWeight('bold');
    if (name === INV) s.getRange('A:F').setNumberFormat('@');
    if (name === LOG) s.getRange('D:D').setNumberFormat('@');
  }
  return s;
}
const norm = x => String(x || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const out = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);

function readAll() {
  const iv = sh(INV, IH).getDataRange().getValues().slice(1).filter(r => r[0] !== '').map(r => ({
    mpn: String(r[0]), mfr: String(r[1]), type: String(r[2]), value: String(r[3]), pkg: String(r[4]),
    tol: String(r[5]), qty: Number(r[6]) || 0, loc: String(r[7])
  }));
  const log = sh(LOG, LH).getDataRange().getValues().slice(1).slice(-300).reverse().map(r => ({
    t: new Date(r[0]).getTime(), user: String(r[1]), kind: String(r[2]), mpn: String(r[3]),
    delta: Number(r[4]) || 0, after: r[5] === '' ? null : Number(r[5])
  }));
  return { ok: true, items: iv, log };
}

function doGet() { return out(readAll()); }

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const b = JSON.parse(e.postData.contents);
    const si = sh(INV, IH), sl = sh(LOG, LH);
    const rows = si.getDataRange().getValues();
    const now = new Date();
    const find = m => { for (let i = 1; i < rows.length; i++) if (norm(rows[i][0]) === norm(m)) return i + 1; return 0; };
    const upsert = (it, mode) => {
      const r = find(it.mpn);
      if (r) {
        const o = rows[r - 1], cur = Number(o[6]) || 0;
        const q = mode === 'add' ? cur + Number(it.qty || 0) : Number(it.qty || 0);
        const v = [o[0], it.mfr || o[1], it.type || o[2], it.value || o[3], it.pkg || o[4], it.tol || o[5], q, it.loc || o[7], now];
        si.getRange(r, 1, 1, 9).setValues([v]); rows[r - 1] = v; return q;
      }
      const v = [it.mpn, it.mfr || '', it.type || '', it.value || '', it.pkg || '', it.tol || '', Number(it.qty || 0), it.loc || '', now];
      si.appendRow(v); rows.push(v); return v[6];
    };
    let after = null, delta = 0, mpn = '';
    if (b.op === 'add') { after = upsert(b.item, 'add'); delta = Number(b.item.qty || 0); mpn = b.item.mpn; }
    else if (b.op === 'take') {
      const r = find(b.mpn);
      if (!r) throw new Error('No existe ' + b.mpn);
      const cur = Number(rows[r - 1][6]) || 0;
      after = Math.max(0, cur - Number(b.n || 0)); delta = after - cur; mpn = rows[r - 1][0];
      si.getRange(r, 7).setValue(after); si.getRange(r, 9).setValue(now);
    } else if (b.op === 'import') { (b.items || []).forEach(it => upsert(it, 'set')); delta = (b.items || []).length; mpn = b.name || 'CSV'; }
    if (b.op) sl.appendRow([now, b.user || '—', b.kind || b.op, mpn, delta, after === null ? '' : after]);
    return out(readAll());
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
