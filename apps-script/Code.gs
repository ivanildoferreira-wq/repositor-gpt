/**
 * Repositor GPT — API para Google Sheets.
 * Configure API_TOKEN em Project Settings > Script properties.
 */
function doGet(e) {
  return json_({ ok: true, service: "repositor-gpt", version: "1.0.0" });
}
function doPost(e) {
  try {
    const supplied = e && e.parameter ? e.parameter.key : "";
    const expected = PropertiesService.getScriptProperties().getProperty("API_TOKEN");
    if (!expected || !supplied || !constantTimeEquals_(String(supplied), String(expected))) {
      return json_({ ok: false, error: "Não autorizado." });
    }
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    const request = JSON.parse(raw);
    return json_({ ok: true, result: dispatch_(request || {}) });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}
function dispatch_(r) {
  switch (r.action) {
    case "listSheets": return listSheets_(r);
    case "readRange": return readRange_(r);
    case "writeRange": return writeRange_(r);
    case "appendRows": return appendRows_(r);
    case "createSheet": return createSheet_(r);
    case "createSpreadsheet": return createSpreadsheet_(r);
    default: throw new Error("Ação não reconhecida.");
  }
}
function spreadsheet_(id) {
  if (!id || typeof id !== "string") throw new Error("Informe spreadsheetId.");
  return SpreadsheetApp.openById(id);
}
function listSheets_(r) {
  const ss = spreadsheet_(r.spreadsheetId);
  return { spreadsheetId: ss.getId(), spreadsheetName: ss.getName(),
    sheets: ss.getSheets().map(s => ({ name: s.getName(), sheetId: s.getSheetId(),
      rows: s.getMaxRows(), columns: s.getMaxColumns() })) };
}
function readRange_(r) {
  const sheet = getSheet_(r);
  const range = safeRange_(sheet, r.range);
  return { spreadsheetId: sheet.getParent().getId(), sheetName: sheet.getName(),
    range: range.getA1Notation(), values: range.getValues() };
}
function writeRange_(r) {
  const sheet = getSheet_(r);
  validateMatrix_(r.values);
  const width = r.values[0].length;
  const cells = r.values.length * width;
  if (cells > 10000) throw new Error("Limite de 10.000 células por operação.");
  const range = safeRange_(sheet, r.range);
  if (range.getNumRows() !== r.values.length || range.getNumColumns() !== width)
    throw new Error("O tamanho de range deve corresponder à matriz values.");
  range.setValues(r.values);
  SpreadsheetApp.flush();
  return { updated: cells, range: range.getA1Notation(), sheetName: sheet.getName() };
}
function appendRows_(r) {
  const sheet = getSheet_(r);
  validateMatrix_(r.values);
  const width = r.values[0].length;
  if (r.values.length * width > 10000) throw new Error("Limite de 10.000 células por operação.");
  const start = sheet.getLastRow() + 1;
  sheet.getRange(start, 1, r.values.length, width).setValues(r.values);
  SpreadsheetApp.flush();
  return { appendedRows: r.values.length, startRow: start, endRow: start + r.values.length - 1 };
}
function createSheet_(r) {
  const ss = spreadsheet_(r.spreadsheetId);
  if (!r.sheetName || typeof r.sheetName !== "string") throw new Error("Informe sheetName.");
  if (ss.getSheetByName(r.sheetName)) throw new Error("Já existe uma aba com esse nome.");
  const sheet = ss.insertSheet(r.sheetName);
  return { sheetName: sheet.getName(), sheetId: sheet.getSheetId() };
}
function createSpreadsheet_(r) {
  if (!r.spreadsheetName || typeof r.spreadsheetName !== "string") throw new Error("Informe spreadsheetName.");
  const ss = SpreadsheetApp.create(r.spreadsheetName);
  return { spreadsheetId: ss.getId(), spreadsheetName: ss.getName(), url: ss.getUrl() };
}
function getSheet_(r) {
  const ss = spreadsheet_(r.spreadsheetId);
  if (!r.sheetName) throw new Error("Informe sheetName.");
  const sheet = ss.getSheetByName(r.sheetName);
  if (!sheet) throw new Error("Aba não encontrada: " + r.sheetName);
  return sheet;
}
function safeRange_(sheet, a1) {
  if (!a1 || typeof a1 !== "string") throw new Error("Informe range em notação A1.");
  const range = sheet.getRange(a1);
  if (range.getNumRows() * range.getNumColumns() > 10000)
    throw new Error("Limite de 10.000 células por operação.");
  return range;
}
function validateMatrix_(values) {
  if (!Array.isArray(values) || !values.length || !Array.isArray(values[0]))
    throw new Error("values deve ser uma matriz bidimensional.");
  const width = values[0].length;
  if (!width || values.some(row => !Array.isArray(row) || row.length !== width))
    throw new Error("Todas as linhas devem ter a mesma quantidade de colunas.");
}
function constantTimeEquals_(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
