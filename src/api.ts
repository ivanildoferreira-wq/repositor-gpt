const endpoint = import.meta.env.VITE_UNIVERSO_IF_API_URL as string | undefined;
type ApiEnvelope<T> = { ok: boolean; result?: T; error?: string };
declare global { interface Window { [key: string]: unknown } }

function jsonp<T>(action: string): Promise<T> {
  if (!endpoint) return Promise.reject(new Error("Backend ainda não configurado."));
  return new Promise((resolve,reject)=>{
    const callback="__universo_if_"+Math.random().toString(36).slice(2);
    const script=document.createElement("script");
    const url=new URL(endpoint);
    url.searchParams.set("action",action); url.searchParams.set("callback",callback);
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
  if(!endpoint) return Promise.reject(new Error("Backend ainda não configurado. Configure VITE_UNIVERSO_IF_API_URL."));
  return new Promise((resolve,reject)=>{
    const frame=document.createElement("iframe");
    const name="universo_if_"+payload.requestId;
    frame.name=name; frame.style.display="none";
    const form=document.createElement("form");
    form.method="POST"; form.action=endpoint; form.target=name; form.style.display="none";
    const fields:{[key:string]:string}={publicAction:"submitEvaluation",payload:JSON.stringify(payload)};
    Object.entries(fields).forEach(([key,value])=>{const input=document.createElement("input");input.type="hidden";input.name=key;input.value=value;form.appendChild(input);});
    const timer=window.setTimeout(()=>finish(new Error("O servidor não confirmou o recebimento. Verifique o ranking antes de tentar novamente.")),20000);
    function onMessage(event:MessageEvent) {
      const data=event.data;
      if(!data||data.type!=="UNIVERSO_IF_RESULT"||data.requestId!==payload.requestId)return;
      if(data.error) finish(new Error(data.error));
      else if(data.result?.accepted) finish(undefined,data.result);
      else finish(new Error("O servidor não confirmou a avaliação."));
    }
    function finish(error?:Error,value?:{accepted:boolean;score:number;message:string}) {
      window.clearTimeout(timer); window.removeEventListener("message",onMessage);
      form.remove(); frame.remove();
      if(error)reject(error);else resolve(value!);
    }
    window.addEventListener("message",onMessage);
    document.body.append(frame,form); form.submit();
  });
}
