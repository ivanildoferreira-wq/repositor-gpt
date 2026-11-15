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
