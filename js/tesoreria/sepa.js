// ============================================================================
// SEPA Core Direct Debit (adeudos directos). Sin librerías externas.
//  · Identificador del acreedor (AT-02), que en España se forma con el NIF:
//    ES + 2 dígitos de control + sufijo de 3 caracteres + NIF. Los dígitos de
//    control salen del NIF + «ES00» (sin el sufijo), módulo 97 (ISO 7064).
//  · Fichero de remesa ISO 20022 pain.008.001.02 (el «Cuaderno 19.14 XML» que
//    aceptan los bancos españoles), con un bloque por tipo de secuencia.
// ============================================================================

const numerico = (s) => s.toUpperCase().replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));
const mod97 = (digitos) => { let r = 0; for (const d of digitos) r = (r * 10 + Number(d)) % 97; return r; };

export function idAcreedor(nif, sufijo = '000') {
  const n = String(nif || '').replace(/[\s-]/g, '').toUpperCase();
  if (!/^[A-Z0-9]{8,9}$/.test(n)) throw new Error('El NIF del Club no es válido.');
  const suf = String(sufijo || '000').toUpperCase();
  if (!/^[A-Z0-9]{3}$/.test(suf)) throw new Error('El sufijo debe tener 3 letras o números (normalmente 000).');
  const control = String(98 - mod97(numerico(`${n}ES00`))).padStart(2, '0');
  return `ES${control}${suf}${n}`;
}
export function idAcreedorValido(id) {
  const s = String(id || '').replace(/\s+/g, '').toUpperCase();
  if (!/^ES\d{2}[A-Z0-9]{3}[A-Z0-9]{8,9}$/.test(s)) return false;
  return idAcreedor(s.slice(7), s.slice(4, 7)) === s;
}

export const bicValido = (bic) => /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(String(bic || '').replace(/\s+/g, '').toUpperCase());

// Juego de caracteres SEPA (el que aceptan todos los bancos): sin acentos ni eñes
export function textoSepa(s, max = 140) {
  return String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[ñÑ]/g, c => (c === 'ñ' ? 'n' : 'N'))
    .replace(/[ºª]/g, '').replace(/[^A-Za-z0-9/\-?:().,'+ ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const iban = (s) => String(s || '').replace(/\s+/g, '').toUpperCase();
const importe = (n) => (Math.round(n * 100) / 100).toFixed(2);
const agente = (bic) => (bic && bicValido(bic) ? `<FinInstnId><BIC>${iban(bic)}</BIC></FinInstnId>` : '<FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId>');

/**
 * Genera el XML de la remesa.
 * acreedor: { id, nombre, iban, bic?, direccion?, poblacion? }
 * cobros:   [{ endToEnd, importe, mandato, fechaFirma, secuencia: 'RCUR'|'OOFF'|'FRST', nombre, iban, bic?, concepto }]
 */
export function remesaXml({ msgId, creado = new Date(), fechaCobro, acreedor, cobros }) {
  if (!cobros.length) throw new Error('La remesa no tiene ningún cobro.');
  const total = cobros.reduce((s, c) => s + c.importe, 0);
  const fechaHora = new Date(creado.getTime() - creado.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
  const nombreAcr = esc(textoSepa(acreedor.nombre, 70));
  const bloques = ['FRST', 'RCUR', 'OOFF'].map(seq => cobros.filter(c => c.secuencia === seq)).filter(l => l.length);
  const direccion = [acreedor.direccion, acreedor.poblacion].filter(Boolean).map(l => `<AdrLine>${esc(textoSepa(l, 70))}</AdrLine>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<CstmrDrctDbtInitn>
<GrpHdr><MsgId>${esc(textoSepa(msgId, 35))}</MsgId><CreDtTm>${fechaHora}</CreDtTm><NbOfTxs>${cobros.length}</NbOfTxs><CtrlSum>${importe(total)}</CtrlSum>
<InitgPty><Nm>${nombreAcr}</Nm><Id><OrgId><Othr><Id>${esc(acreedor.id)}</Id></Othr></OrgId></Id></InitgPty></GrpHdr>
${bloques.map((lista, i) => `<PmtInf><PmtInfId>${esc(textoSepa(`${msgId}-${i + 1}`, 35))}</PmtInfId><PmtMtd>DD</PmtMtd><BtchBookg>true</BtchBookg>
<NbOfTxs>${lista.length}</NbOfTxs><CtrlSum>${importe(lista.reduce((s, c) => s + c.importe, 0))}</CtrlSum>
<PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl><LclInstrm><Cd>CORE</Cd></LclInstrm><SeqTp>${lista[0].secuencia}</SeqTp></PmtTpInf>
<ReqdColltnDt>${fechaCobro}</ReqdColltnDt>
<Cdtr><Nm>${nombreAcr}</Nm>${direccion ? `<PstlAdr><Ctry>ES</Ctry>${direccion}</PstlAdr>` : ''}</Cdtr>
<CdtrAcct><Id><IBAN>${iban(acreedor.iban)}</IBAN></Id></CdtrAcct><CdtrAgt>${agente(acreedor.bic)}</CdtrAgt><ChrgBr>SLEV</ChrgBr>
<CdtrSchmeId><Id><PrvtId><Othr><Id>${esc(acreedor.id)}</Id><SchmeNm><Prtry>SEPA</Prtry></SchmeNm></Othr></PrvtId></Id></CdtrSchmeId>
${lista.map(c => `<DrctDbtTxInf><PmtId><EndToEndId>${esc(textoSepa(c.endToEnd, 35))}</EndToEndId></PmtId><InstdAmt Ccy="EUR">${importe(c.importe)}</InstdAmt>
<DrctDbtTx><MndtRltdInf><MndtId>${esc(textoSepa(c.mandato, 35))}</MndtId><DtOfSgntr>${c.fechaFirma}</DtOfSgntr></MndtRltdInf></DrctDbtTx>
<DbtrAgt>${agente(c.bic)}</DbtrAgt><Dbtr><Nm>${esc(textoSepa(c.nombre, 70))}</Nm></Dbtr><DbtrAcct><Id><IBAN>${iban(c.iban)}</IBAN></Id></DbtrAcct>
<RmtInf><Ustrd>${esc(textoSepa(c.concepto, 140))}</Ustrd></RmtInf></DrctDbtTxInf>`).join('\n')}
</PmtInf>`).join('\n')}
</CstmrDrctDbtInitn>
</Document>
`;
}
