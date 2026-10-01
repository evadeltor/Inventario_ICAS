// Inventario PCB — backend en Google Sheets
// Pegar en Extensiones > Apps Script de la hoja, guardar e Implementar > Nueva implementación > Aplicación web
// (Ejecutar como: Yo · Quién tiene acceso: Cualquier usuario). Copiar la URL /exec en la app.
// Al actualizar este código: Implementar > Gestionar implementaciones > lápiz > Versión: Nueva versión > Implementar (la URL no cambia).
// Correo del administrador que valida categorías nuevas (vacío = el dueño de la hoja)
const ADMIN_EMAIL = '';
const INV = 'Inventario', LOG = 'Historial', CAT = 'Categorias';
const CH = ['categoria', 'estado', 'fecha', 'propuesta_por', 'ejemplo', 'clave'];
const BASE_CATS = ['Resistencia', 'Condensador', 'Bobina', 'Ferrita', 'Diodo', 'LED', 'Transistor', 'MOSFET', 'Regulador', 'Oscilador / cristal', 'Microcontrolador', 'Amplificador operacional', 'Sensor', 'Conector', 'Fusible', 'Integrado', 'Otro'];
const CODES = { R: 'Resistencia', C: 'Condensador', L: 'Bobina', IC: 'Integrado', O: 'Otro' };
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
    if (name === CAT) { const now = new Date(); s.getRange(2, 1, BASE_CATS.length, 6).setValues(BASE_CATS.map(c => [c, 'Aprobada', now, 'sistema', '', ''])); }
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
  const cats = sh(CAT, CH).getDataRange().getValues().slice(1).filter(r => r[0] !== '').map(r => ({ name: String(r[0]), status: String(r[1]) }));
  return { ok: true, items: iv, log, cats };
}

function catName(t) { const s = String(t || '').trim(); return CODES[s] || s; }
function proposeCat(type, user, mpn) {
  const name = catName(type);
  if (!name) return;
  const s = sh(CAT, CH), rows = s.getDataRange().getValues();
  if (rows.slice(1).some(r => String(r[0]).toLowerCase() === name.toLowerCase())) return;
  const key = Utilities.getUuid();
  s.appendRow([name, 'Pendiente validación', new Date(), user || '—', mpn || '', key]);
  s.getRange(s.getLastRow(), 1, 1, 2).setBackground('#fff4cc');
  const url = ScriptApp.getService().getUrl(), q = '?cat=' + encodeURIComponent(name) + '&k=' + key;
  const to = ADMIN_EMAIL || Session.getEffectiveUser().getEmail();
  MailApp.sendEmail({
    to, subject: 'Inventario PCB · nueva categoría «' + name + '» pendiente de validación',
    htmlBody: '<p>Se ha creado la categoría <b>' + name + '</b>' + (mpn ? ' al dar de alta <b>' + mpn + '</b>' : '') + ' (usuario: ' + (user || '—') + ').</p>'
      + '<p>Verifica que es correcta:</p>'
      + '<p><a href="' + url + q + '&do=ok" style="background:#5980a6;color:#fff;padding:10px 18px;text-decoration:none">Aceptar categoría</a> &nbsp; '
      + '<a href="' + url + q + '&do=no">Rechazar</a></p>'
      + '<p style="color:#666">Si la rechazas, las piezas con esta categoría pasan a «Otro».</p>'
  });
}
function decide(p) {
  const s = sh(CAT, CH), rows = s.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) !== p.cat || String(rows[i][5]) !== p.k) continue;
    if (String(rows[i][1]) !== 'Pendiente validación') return 'La categoría «' + p.cat + '» ya estaba ' + String(rows[i][1]).toLowerCase() + '.';
    const ok = p.do === 'ok';
    s.getRange(i + 1, 2).setValue(ok ? 'Aprobada' : 'Rechazada');
    s.getRange(i + 1, 1, 1, 2).setBackground(ok ? null : '#f3d6d6');
    if (!ok) {
      const si = sh(INV, IH), iv = si.getDataRange().getValues();
      for (let j = 1; j < iv.length; j++) if (String(iv[j][2]).toLowerCase() === p.cat.toLowerCase()) si.getRange(j + 1, 3).setValue('Otro');
    }
    return ok ? 'Categoría «' + p.cat + '» aceptada.' : 'Categoría «' + p.cat + '» rechazada; sus piezas pasan a «Otro».';
  }
  return 'Enlace no válido o caducado.';
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.cat && p.k && p.do) {
    const lock = LockService.getScriptLock(); lock.waitLock(15000);
    let msg; try { msg = decide(p); } finally { lock.releaseLock(); }
    return HtmlService.createHtmlOutput('<div style="font-family:sans-serif;padding:40px;font-size:20px">' + msg + '</div>').setTitle('Inventario PCB');
  }
  return out(readAll());
}

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
    if (b.op === 'add') { after = upsert(b.item, 'add'); delta = Number(b.item.qty || 0); mpn = b.item.mpn; proposeCat(b.item.type, b.user, String(b.item.mpn).replace(/^'/, '')); }
    else if (b.op === 'take') {
      const r = find(b.mpn);
      if (!r) throw new Error('No existe ' + b.mpn);
      const cur = Number(rows[r - 1][6]) || 0;
      after = Math.max(0, cur - Number(b.n || 0)); delta = after - cur; mpn = rows[r - 1][0];
      si.getRange(r, 7).setValue(after); si.getRange(r, 9).setValue(now);
    } else if (b.op === 'import') { (b.items || []).forEach(it => { upsert(it, 'set'); proposeCat(it.type, b.user, String(it.mpn).replace(/^'/, '')); }); delta = (b.items || []).length; mpn = b.name || 'CSV'; }
    if (b.op) sl.appendRow([now, b.user || '—', b.kind || b.op, mpn, delta, after === null ? '' : after]);
    return out(readAll());
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
