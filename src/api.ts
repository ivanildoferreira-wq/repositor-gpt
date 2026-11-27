// Endpoint público do Apps Script; pode ser substituído no build por VITE_UNIVERSO_IF_API_URL.
// Não coloque CODE_PEPPER, API_TOKEN ou códigos individuais neste arquivo.
const endpoint = (import.meta as ImportMeta & { env?: { VITE_UNIVERSO_IF_API_URL?: string } }).env?.VITE_UNIVERSO_IF_API_URL || 'https://script.google.com/a/macros/acad.ifma.edu.br/s/AKfycbzMZr-e8DNX2QZ9v6NCUZSXb-AOvkY6LhnBA5l-V3bdnn8OLclWjGlFxEq0VEdxHH0_/exec';
type ApiEnvelope<T> = { ok: boolean; result?: T; error?: string };
declare global { interface Window { [key: string]: unknown } }

function jsonp<T>(action: string, params: Record<string,string> = {}): Promise<T> {
  if (!endpoint) return Promise.reject(new Error("Backend ainda não configurado."));
  return new Promise((resolve,reject)=>{
    const callback="__universo_if_"+Math.random().toString(36).slice(2);
    const script=document.createElement("script");
    const url=new URL(endpoint);
    url.searchParams.set("action",action); url.searchParams.set("callback",callback);
    Object.entries(params).forEach(([key,value])=>url.searchParams.set(key,value));
    const timer=window.setTimeout(()=>finish(new Error("Tempo esgotado ao consultar o servidor.")),15000);
    function finish(error?:Error,value?:T) {
      window.clearTimeout(timer); delete window[callback]; script.remove();
      if(error) reject(error); else resolve(value as T);
    }
    window[callback]=(data:ApiEnvelope<T>)=>data?.ok?finish(undefined,data.result):finish(new Error(data?.error||"Falha na consulta."));
    script.onerror=()=>finish(new Error("Não foi possível conectar ao Apps Script."));
    script.src=url.toString(); document.body.appendChild(script);
  });
}
export function carregarProjetos<T>():Promise<T[]> { return jsonp<T[]>("projects"); }
export function carregarRanking<T>():Promise<T[]> { return jsonp<T[]>("ranking"); }
export type EnvioAvaliacao = { requestId:string; projectId:string; code:string; scores:number[] };
export function enviarAvaliacao(payload:EnvioAvaliacao):Promise<{accepted:boolean;score:number;message:string}> {
  if(!endpoint) return Promise.reject(new Error("Backend ainda não configurado."));
  return new Promise((resolve,reject)=>{
    const frame=document.createElement("iframe");
    const name="universo_if_"+payload.requestId;
    frame.name=name; frame.style.display="none";
    const form=document.createElement("form");
    form.method="POST"; form.action=endpoint; form.target=name; form.style.display="none";
    const fields:Record<string,string>={publicAction:"submitEvaluation",payload:JSON.stringify(payload)};
    Object.entries(fields).forEach(([key,value])=>{
      const input=document.createElement("input");
      input.type="hidden"; input.name=key; input.value=value; form.appendChild(input);
    });

    let finished=false, checkingReceipt=false, serverError="";
    let receiptPoller:number|undefined, timer:number|undefined;
    function finish(error?:Error,value?:{accepted:boolean;score:number;message:string}) {
      if(finished)return;
      finished=true;
      if(timer!==undefined)window.clearTimeout(timer);
      if(receiptPoller!==undefined)window.clearInterval(receiptPoller);
      window.removeEventListener("message",onMessage);
      form.remove(); frame.remove();
      if(error)reject(error);else resolve(value!);
    }
    async function checkReceipt() {
      if(finished||checkingReceipt)return;
      checkingReceipt=true;
      try {
        const receipt=await jsonp<{received:boolean;score?:number}>("receipt",{requestId:payload.requestId});
        if(receipt.received && typeof receipt.score==="number" && Number.isFinite(receipt.score))
          finish(undefined,{accepted:true,score:receipt.score,message:"Avaliação registrada com sucesso."});
      } catch {
        // Falhas transitórias de JSONP não significam que a gravação falhou.
      } finally { checkingReceipt=false; }
    }
    function onMessage(event:MessageEvent) {
      const data=event.data;
      const trustedOrigin=/^https:\/\/(?:script\.google\.com|(?:[a-z0-9-]+\.)?googleusercontent\.com)$/.test(event.origin);
      if(!trustedOrigin||!data||data.type!=="UNIVERSO_IF_RESULT"||data.requestId!==payload.requestId)return;
      if(data.result?.accepted && typeof data.result.score==="number") {
        finish(undefined,data.result);
      } else {
        // Mesmo uma mensagem de erro pode chegar depois de o voto ter sido gravado.
        // Consulte o recibo antes de mostrar qualquer falha ao participante.
        serverError=typeof data.error==="string"?data.error:"O servidor não confirmou o recebimento.";
        void checkReceipt();
      }
    }
    window.addEventListener("message",onMessage);
    frame.addEventListener("load",()=>{void checkReceipt();});
    document.body.append(frame,form);
    receiptPoller=window.setInterval(()=>{void checkReceipt();},2500);
    timer=window.setTimeout(async()=>{
      await checkReceipt();
      if(!finished)finish(new Error(serverError
        ? serverError+" Verifique com a organização antes de tentar novamente."
        : "Não foi possível confirmar o registro. Não envie novamente antes de verificar com a organização."));
    },60000);
    form.submit();
  });
}

export type Participant = { registered:boolean; open:boolean; code?:string; projectIds?:string[]; total?:number; remaining?:number; waitMs?:number; limit?:number; minutes?:number };
const participantKey='universo-if-browser-v1';
export function existingBrowserToken():string|null {
  try { const t=localStorage.getItem(participantKey); return t&&/^[A-F0-9]{64}$/.test(t)?t:null; } catch {return null;}
}
export function browserToken():string {
  const old=existingBrowserToken(); if(old)return old;
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
  try {localStorage.setItem(participantKey,token);if(localStorage.getItem(participantKey)!==token)throw new Error();}catch{throw new Error('Permita o armazenamento local do navegador para manter seu código individual.');}
  return token;
}
export async function participantApi(token:string,create:boolean,statusOnly=false):Promise<Participant> {
  const requestId=crypto.randomUUID().replace(/-/g,'');
  const payload=JSON.stringify({token,create,requestId,...(statusOnly?{statusOnly:true}:{})});
  const fields={publicAction:'participant',payload};
  // POST evita colocar o identificador privado na URL. Repetição é idempotente.
  const controller=new AbortController();
  const timer=window.setTimeout(()=>controller.abort(),15000);
  let response:ApiEnvelope<Participant>|undefined;
  try {
    const res=await fetch(endpoint,{method:'POST',body:new URLSearchParams(fields),signal:controller.signal,credentials:'omit'});
    if(res.ok)response=await res.json();
  }catch{/* Alguns ambientes Google não disponibilizam CORS; usar o transporte alternativo. */}
  finally{window.clearTimeout(timer);}
  if(response&&typeof response.ok==='boolean'){
    if(!response.ok||!response.result)throw new Error(response.error||'Não foi possível obter seu código.');
    return response.result;
  }
  return new Promise((resolve,reject)=>{
    const frame=document.createElement('iframe');frame.name='participant_'+requestId;frame.style.display='none';
    const form=document.createElement('form');form.method='POST';form.action=endpoint;form.target=frame.name;form.style.display='none';
    for(const [name,value] of Object.entries({...fields,transport:'iframe'})){const input=document.createElement('input');input.type='hidden';input.name=name;input.value=value;form.appendChild(input);}
    const timeout=window.setTimeout(()=>finish(new Error('Não foi possível confirmar seu código. Tente novamente neste mesmo navegador.')),25000);
    function finish(error?:Error,result?:Participant){window.clearTimeout(timeout);window.removeEventListener('message',onMessage);form.remove();frame.remove();if(error)reject(error);else resolve(result!);}
    function onMessage(event:MessageEvent){
      const d=event.data;
      if(!/^https:\/\/(?:script\.google\.com|(?:[a-z0-9-]+\.)?googleusercontent\.com)$/.test(event.origin)||d?.type!=='UNIVERSO_IF_PARTICIPANT'||d.requestId!==requestId)return;
      if(d.ok&&d.result)finish(undefined,d.result);else finish(new Error(d.error||'Não foi possível obter seu código.'));
    }
    window.addEventListener('message',onMessage);document.body.append(frame,form);form.submit();
  });
}


// Consulta somente leitura: identificador temporário, sem emitir código nem gravar dados.
export async function consultarStatusVotacao():Promise<boolean>{
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
  const result=await participantApi(token,false,true);
  if(typeof result.open!=='boolean')throw new Error('Situação da votação indisponível.');
  return result.open;
}
