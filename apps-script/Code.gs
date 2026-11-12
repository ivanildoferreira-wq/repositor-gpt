/**
 * Universo IF Avalia — API pública restrita + API administrativa legada.
 * Propriedades obrigatórias: SPREADSHEET_ID e CODE_PEPPER.
 * Não coloque segredos neste arquivo nem no Git.
 */
function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || "health");
  try {
    let result;
    if (action === "projects") result = publicProjects_();
    else if (action === "ranking") result = publicRanking_();
    else if (action === "health") result = { ok: true, service: "universo-if-avalia", version: "1.0.0" };
    else throw new Error("Ação pública não reconhecida.");
    return output_(e, { ok: true, result: result });
  } catch (err) {
    return output_(e, { ok: false, error: safeMessage_(err) });
  }
}
function doPost(e) {
  try {
    // Envio público por formulário HTML direcionado a iframe: evita preflight CORS.
    if (e && e.parameter && e.parameter.publicAction === "submitEvaluation") {
      const payload = JSON.parse(e.parameter.payload || "{}");
      const result = submitEvaluation_(payload);
      return HtmlService.createHtmlOutput(
        '<!doctype html><meta charset="utf-8"><script>parent.postMessage(' +
        JSON.stringify({ type: "UNIVERSO_IF_RESULT", requestId: payload.requestId, result: result }) +
        ',"*");</script><p>Envio processado. Você pode fechar esta janela.</p>'
      );
    }
    // API administrativa preexistente: exige token privado.
    const supplied = e && e.parameter ? e.parameter.key : "";
    const expected = PropertiesService.getScriptProperties().getProperty("API_TOKEN");
    if (!expected || !supplied || !constantTimeEquals_(String(supplied), String(expected)))
      return json_({ ok: false, error: "Não autorizado." });
    const request = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : "{}");
    return json_({ ok: true, result: dispatch_(request || {}) });
  } catch (err) {
    if (e && e.parameter && e.parameter.publicAction === "submitEvaluation") {
      return HtmlService.createHtmlOutput('<!doctype html><meta charset="utf-8"><script>parent.postMessage(' +
        JSON.stringify({ type: "UNIVERSO_IF_RESULT", requestId: (function(){try{return JSON.parse(e.parameter.payload||"{}").requestId||"";}catch(x){return "";}})(), error: safeMessage_(err) }) +
        ',"*");</script><p>Não foi possível registrar a avaliação.</p>');
    }
    return json_({ ok: false, error: safeMessage_(err) });
  }
}
function output_(e, data) {
  const callback = e && e.parameter ? String(e.parameter.callback || "") : "";
  if (callback) {
    if (!/^[A-Za-z_$][0-9A-Za-z_$\.]{0,80}$/.test(callback)) throw new Error("Callback inválido.");
    return ContentService.createTextOutput(callback + "(" + JSON.stringify(data) + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return json_(data);
}
const U_HEADERS = {
  Projetos: ["id","titulo","modalidade","area_tematica","data","inicio","fim","formato","local","fontes"],
  Codigos: ["hash_codigo","ativo","criado_em","observacao"],
  Avaliacoes: ["request_id","hash_codigo","id_projeto","nota_1","nota_2","nota_3","nota_4","nota_ponderada","criado_em"],
  Configuracao: ["chave","valor"]
};
/** Execute manualmente uma vez no editor do Apps Script, após definir SPREADSHEET_ID e CODE_PEPPER. */
function setupUniversoIF() {
  const ss = getSpreadsheet_();
  Object.keys(U_HEADERS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1,1,1,U_HEADERS[name].length).setValues([U_HEADERS[name]]);
      sh.setFrozenRows(1);
    }
  });
  const cfg = ss.getSheetByName("Configuracao");
  if (cfg.getLastRow() < 2) cfg.getRange(2,1,3,2).setValues([
    ["votacao_aberta","TRUE"],["minimo_ranking","5"],["catalogo_versao","1.0"]
  ]);
  return { spreadsheet: ss.getName(), sheets: Object.keys(U_HEADERS), next: "Importe o CSV oficial na aba Projetos, sem substituir o cabeçalho." };
}
/** Retorna códigos em execução manual. Entregue-os aos participantes de forma privada e não execute novamente. */
function gerarCodigosUniversoIF(quantidade) {
  const n = Number(quantidade);
  if (!Number.isInteger(n) || n < 1 || n > 5000) throw new Error("Quantidade deve ser de 1 a 5000.");
  const sh = getSpreadsheet_().getSheetByName("Codigos");
  if (!sh || sh.getLastRow() < 1) throw new Error("Execute setupUniversoIF primeiro.");
  const pepper = requiredProp_("CODE_PEPPER");
  const plain = [], rows = [];
  for (let i=0;i<n;i++) {
    const code = Utilities.getUuid().replace(/-/g,"").slice(0,12).toUpperCase();
    plain.push(code);
    rows.push([hashCode_(code,pepper),true,new Date(),""]);
  }
  sh.getRange(sh.getLastRow()+1,1,rows.length,4).setValues(rows);
  return plain; // Só aparece no log da execução. Copie e guarde com segurança.
}
function publicProjects_() {
  const sh = getSpreadsheet_().getSheetByName("Projetos");
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getRange(2,1,sh.getLastRow()-1,10).getDisplayValues();
  return values.filter(r => r[0]).map(r => ({
    id:r[0],titulo:r[1],modalidade:r[2],area_tematica:r[3],data:r[4],
    inicio:r[5],fim:r[6],formato:r[7],local:r[8],
    fontes: String(r[9] || "").split("|").filter(Boolean)
  }));
}
function publicRanking_() {
  const ss = getSpreadsheet_(), sh = ss.getSheetByName("Avaliacoes");
  if (!sh || sh.getLastRow() < 2) return [];
  const min = Number(configValue_("minimo_ranking","5"));
  const rows = sh.getRange(2,1,sh.getLastRow()-1,9).getValues();
  const sums = {};
  rows.forEach(r => {
    const id=String(r[2] || ""), score=Number(r[7]);
    if (!id || !isFinite(score)) return;
    if (!sums[id]) sums[id]={total:0,count:0};
    sums[id].total+=score; sums[id].count++;
  });
  const projects=publicProjects_(), byId={};
  projects.forEach(p=>byId[p.id]=p);
  return Object.keys(sums).filter(id=>sums[id].count>=min && byId[id])
    .map(id=>({id:id,titulo:byId[id].titulo,modalidade:byId[id].modalidade,
      media:Number((sums[id].total/sums[id].count).toFixed(2)),avaliacoes:sums[id].count}))
    .sort((a,b)=>a.modalidade.localeCompare(b.modalidade)||b.media-a.media||b.avaliacoes-a.avaliacoes);
}
function submitEvaluation_(p) {
  if (!p || !/^[A-Za-z0-9_-]{12,80}$/.test(String(p.requestId||""))) throw new Error("Identificador da solicitação inválido.");
  const projectId=String(p.projectId||"").trim(), code=String(p.code||"").replace(/\s/g,"").toUpperCase();
  const scores=p.scores;
  if (!projectId || !/^[A-Z0-9-]{6,20}$/.test(projectId)) throw new Error("Projeto inválido.");
  if (!/^[A-F0-9]{12}$/.test(code)) throw new Error("Código inválido.");
  if (!Array.isArray(scores)||scores.length!==4||scores.some(n=>!Number.isInteger(n)||n<1||n>5)) throw new Error("Informe quatro notas inteiras entre 1 e 5.");
  if (configValue_("votacao_aberta","TRUE")!=="TRUE") throw new Error("A votação está encerrada.");
  const ss=getSpreadsheet_(), codes=ss.getSheetByName("Codigos"), votes=ss.getSheetByName("Avaliacoes");
  const projects=publicProjects_();
  if (!projects.some(x=>x.id===projectId)) throw new Error("Projeto não encontrado.");
  const pepper=requiredProp_("CODE_PEPPER"), digest=hashCode_(code,pepper);
  const lock=LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const existingReq=findValue_(votes,1,p.requestId);
    if (existingReq) {
      const prior=votes.getRange(existingReq,2,1,7).getValues()[0];
      if (String(prior[0])!==digest || String(prior[1])!==projectId ||
          scores.some((v,i)=>Number(prior[i+2])!==v))
        throw new Error("Identificador de solicitação já utilizado.");
      return { accepted:true, duplicateRequest:true, score:Number(prior[6]), message:"Esta solicitação já foi registrada." };
    }
    const codeRow=findValue_(codes,1,digest);
    if (!codeRow) throw new Error("Código não reconhecido.");
    if (String(codes.getRange(codeRow,2).getValue()).toUpperCase()==="FALSE") throw new Error("Código desativado.");
    const last=votes.getLastRow();
    if (last>=2) {
      const prior=votes.getRange(2,2,last-1,2).getValues();
      if (prior.some(r=>String(r[0])===digest && String(r[1])===projectId))
        throw new Error("Este código já avaliou este projeto.");
    }
    const weighted=Number((scores[0]*.30+scores[1]*.30+scores[2]*.25+scores[3]*.15).toFixed(2));
    votes.appendRow([p.requestId,digest,projectId,scores[0],scores[1],scores[2],scores[3],weighted,new Date()]);
    return { accepted:true,score:weighted,message:"Avaliação registrada com sucesso." };
  } finally { lock.releaseLock(); }
}
function findValue_(sh,col,value) {
  if (sh.getLastRow()<2) return 0;
  const found=sh.getRange(2,col,sh.getLastRow()-1,1).createTextFinder(String(value)).matchEntireCell(true).findNext();
  return found ? found.getRow() : 0;
}
function configValue_(key,fallback) {
  const sh=getSpreadsheet_().getSheetByName("Configuracao");
  if (!sh || sh.getLastRow()<2) return fallback;
  const rows=sh.getRange(2,1,sh.getLastRow()-1,2).getDisplayValues();
  const hit=rows.find(r=>r[0]===key);
  return hit ? hit[1] : fallback;
}
function getSpreadsheet_() { return SpreadsheetApp.openById(requiredProp_("SPREADSHEET_ID")); }
function requiredProp_(key) {
  const value=PropertiesService.getScriptProperties().getProperty(key);
  if (!value) throw new Error("Configure a propriedade privada " + key + ".");
  return value;
}
function hashCode_(code,pepper) {
  const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,pepper+":"+code,Utilities.Charset.UTF_8);
  return bytes.map(b=>(b<0?b+256:b).toString(16).padStart(2,"0")).join("").toUpperCase();
}
function safeMessage_(err) { return String(err&&err.message?err.message:err).slice(0,240); }

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
