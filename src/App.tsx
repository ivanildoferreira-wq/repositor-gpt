import { useEffect, useMemo, useState, useRef } from 'react';
import { carregarProjetos, carregarRanking, enviarAvaliacao as enviarAvaliacaoApi, participantApi, browserToken, existingBrowserToken, type Participant } from './api';
import { Search, Grid3X3, Trophy, ArrowLeft, Star, AlertCircle, Layers3, BookOpen, Users, Leaf, Cpu, FlaskConical, GraduationCap, CalendarDays, ArrowRight, SlidersHorizontal, X, Brain, Medal, Globe2, RefreshCw, BarChart3 } from 'lucide-react';
import rawCatalog from './catalogo.json';
import { calcularNota, CRITERIOS, normalizarBusca, validarCatalogo, intercalarModalidades, ordenarRanking, type Projeto, type Modalidade } from './domain';

type Aba = 'projetos' | 'ranking' | 'avaliar';
const catalogoInicial = validarCatalogo(rawCatalog);
const rotulos = ['Muito ruim', 'Ruim', 'Regular', 'Bom', 'Excelente'];
type LinhaRanking = {id:string;titulo:string;modalidade:Modalidade;media:number;avaliacoes:number};
// Valores sintéticos gerados apenas no navegador; nenhuma gravação no backend.
function gerarRankingDemonstracao(projetos: Projeto[]): LinhaRanking[] {
  const modalidades: Modalidade[] = ['Mostra Nacional', 'Mostra de Extensão'];
  return modalidades.flatMap(modalidade => projetos.filter(p=>p.modalidade===modalidade).slice(0,6).map((p,i)=>({
    id:p.id, titulo:p.titulo, modalidade:p.modalidade,
    media:Number((4.85-i*0.19).toFixed(2)), avaliacoes:5+i
  })));
}

// Ícones temáticos derivados do título e da área já cadastrados, sem alterar o catálogo.
function temaProjeto(p: Projeto) {
  const t=normalizarBusca(p.titulo+' '+p.area_tematica);
  if (/robotica|programacao|tecnologia|computacao|informatica/.test(t)) return {icone:Cpu,tema:'tecnologia'};
  if (/meditacao|psicolog|cognitiv|emociona/.test(t)) return {icone:Brain,tema:'bemestar'};
  if (/biolog|ambient|ecolog|agricult|sustentab/.test(t)) return {icone:Leaf,tema:'natureza'};
  if (/leitura|literatur|linguistic|livro|letras/.test(t)) return {icone:BookOpen,tema:'cultura'};
  if (/quimic|fisic|laborator/.test(t)) return {icone:FlaskConical,tema:'ciencia'};
  if (/humanas|social|identidade|cultura|comunidade/.test(t)) return {icone:Users,tema:'sociedade'};
  return {icone:GraduationCap,tema:'educacao'};
}
function dataLegivel(value: string) {
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? m[3]+'/'+m[2]+'/'+m[1] : value;
}

export default function App() {
  const [aba, setAba] = useState<Aba>('projetos');
  const [catalogo, setCatalogo] = useState<Projeto[]>(catalogoInicial);
  const [ranking, setRanking] = useState<LinhaRanking[]>([]);
  const [modoDemonstracao, setModoDemonstracao] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [rankingErro, setRankingErro] = useState(false);
  const [atualizacao, setAtualizacao] = useState(0);
  const [rankingData, setRankingData] = useState('');
  const [busca, setBusca] = useState('');
  const [buscaRanking, setBuscaRanking] = useState('');
  const [modalidade, setModalidade] = useState<'Todas' | Modalidade>('Todas');
  const [selecionado, setSelecionado] = useState<Projeto | null>(null);
  const [notas, setNotas] = useState<number[]>([0, 0, 0, 0]);
  const [codigo, setCodigo] = useState('');
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [participant,setParticipant]=useState<Participant|null>(null);
  const [participantBusy,setParticipantBusy]=useState(false);
  const [participantError,setParticipantError]=useState('');
  const [waitUntil,setWaitUntil]=useState(0);
  const [now,setNow]=useState(Date.now());
  const participantLock=useRef(false);
  const participantRevision=useRef(0);
  const participantRefreshPending=useRef(false);
  const envioEmCurso = useRef(false);
  const waitSeconds=Math.max(0,Math.ceil((waitUntil-now)/1000));
  const alreadyVoted=!!selecionado&&!!participant?.projectIds?.includes(selecionado.id);
  const checkingFirstCode=participantBusy&&!participant?.registered;
  function applyParticipant(p:Participant) {
    setParticipant(p);if(p.registered&&p.code)setCodigo(p.code);
    const t=Date.now();setNow(t);setWaitUntil(t+(p.waitMs||0));
  }
  async function obterCodigo(create=true) {
    if(participantLock.current)return;
    participantLock.current=true;setParticipantBusy(true);setParticipantError('');
    const revision=participantRevision.current;
    try {const token=create?browserToken():existingBrowserToken();if(token){const p=await participantApi(token,create);if(revision===participantRevision.current)applyParticipant(p);}}
    catch(e){if(revision===participantRevision.current)setParticipantError(e instanceof Error?e.message:'Falha ao consultar seu código.');}
    finally{participantLock.current=false;setParticipantBusy(false);if(participantRefreshPending.current&&!envioEmCurso.current){participantRefreshPending.current=false;void obterCodigo(false);}}
  }
  useEffect(()=>{if(existingBrowserToken())void obterCodigo(false);},[]);
  useEffect(()=>{if(!waitUntil)return;const t=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(t);},[waitUntil]);
  useEffect(()=>{if(waitUntil&&now>=waitUntil){setWaitUntil(0);void obterCodigo(false);}},[now,waitUntil]);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if(aba==='avaliar') heading.current?.focus(); }, [aba]);

  useEffect(() => {
    carregarProjetos<Projeto>().then(data => { if (data.length) setCatalogo(validarCatalogo(data)); }).catch(() => {});
  }, []);
  useEffect(() => {
    if (aba !== 'ranking') return;
    let ativo = true;
    setCarregando(true); setRankingErro(false);
    carregarRanking<{id:string;titulo:string;modalidade:Modalidade;media:number;avaliacoes:number}>()
      .then(data => { if(ativo) {setRanking(data); setRankingData(new Date().toLocaleTimeString('pt-BR'));} }).catch(() => {if(ativo) setRankingErro(true);}).finally(() => {if(ativo) setCarregando(false);});
    return () => {ativo=false;};
  }, [aba, atualizacao]);

  const filtrados = useMemo(() => {
    const resultados=catalogo.filter(p =>
      (modalidade === 'Todas' || p.modalidade === modalidade) &&
      normalizarBusca([p.titulo,p.id,p.area_tematica].join(' ')).includes(normalizarBusca(busca))
    );
    return modalidade==='Todas'?intercalarModalidades(resultados):resultados;
  }, [catalogo, busca, modalidade]);

  const notaPrevista = notas.every(n => n >= 1) ? calcularNota(notas).toFixed(2) : '—';
  const rankingExibido = modoDemonstracao ? gerarRankingDemonstracao(catalogo) : ranking;

  const termoRanking = normalizarBusca(buscaRanking);
  const correspondeRanking = (item: {id:string;titulo:string;modalidade:Modalidade}) => normalizarBusca([item.id,item.titulo,item.modalidade].join(' ')).includes(termoRanking);
  const projetosSemClassificacao = termoRanking ? catalogo.filter(p=>correspondeRanking(p)&&!rankingExibido.some(r=>r.id===p.id)) : [];

  function abrirAvaliacao(projeto: Projeto) {
    setSelecionado(projeto); setNotas([0, 0, 0, 0]); setCodigo(participant?.code||''); setAviso(''); setEnviando(false); setEnviado(false); setAba('avaliar'); if(existingBrowserToken()&&!participant?.registered)void obterCodigo(false);
  }

  async function enviarAvaliacao() {
    if (envioEmCurso.current || enviado || alreadyVoted || waitSeconds>0 || checkingFirstCode) return;
    if (!selecionado || !codigo.trim() || notas.some(n => n < 1 || n > 5)) {
      setAviso('Preencha o código e os quatro critérios antes de continuar.'); return;
    }
    if (!/^[A-F0-9]{12}$/.test(codigo.replace(/\s/g,'').toUpperCase())) {setAviso('Informe um código válido de 12 caracteres (A–F e 0–9).'); return;}
    envioEmCurso.current=true;
    participantRevision.current++;
    setEnviando(true);
    setAviso('Enviando avaliação…');
    try {
      const result = await enviarAvaliacaoApi({requestId: crypto.randomUUID().replace(/-/g,''), projectId: selecionado.id, code: codigo.trim(), scores: notas});
      setAviso(result.message + ' Nota registrada: ' + result.score.toFixed(2) + '.');
      setEnviado(true);
      if(participant?.registered&&selecionado){const ids=Array.from(new Set([...(participant.projectIds||[]),selecionado.id]));setParticipant({...participant,projectIds:ids,total:ids.length});if(ids.length%(participant.limit||5)===0){const t=Date.now();setNow(t);setWaitUntil(t+(participant.minutes||10)*60000);}}
    } catch (error) { setAviso(error instanceof Error ? error.message : 'Não foi possível enviar a avaliação.'); }
    finally { envioEmCurso.current=false; setEnviando(false); if(existingBrowserToken()){if(participantLock.current)participantRefreshPending.current=true;else void obterCodigo(false);} }
  }

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#inicio" onClick={e => {if(enviando){e.preventDefault();return;}setAba('projetos');setSelecionado(null)}}><span className="brand-mark">IF</span><span>UNIVERSO <b>IF AVALIA</b><small>PARTICIPAÇÃO POPULAR EDUCATIVA</small></span></a><span className="academic-tag">PROJETO ACADÊMICO · 2026.2</span></header>
    <main>
      <section className="hero"><div><p className="eyebrow">IFMA · MOSTRAS 2026</p><h1>Ideias que transformam.<br/><em>Conheça e avalie.</em></h1><p className="hero-copy">Explore os projetos apresentados e participe desta experiência educativa.</p></div><div className="hero-stamp"><span>{catalogo.length}</span><small>PROJETOS<br/>PREVISTOS</small></div></section>
      <section className="participation-panel" aria-label="Participação">
        <div><strong>{participant?.registered?'Seu código individual está ativo':'Participe sem login ou cadastro'}</strong><p>{participant?.registered?'Use o mesmo navegador para avaliar outros projetos.':'Obtenha seu código individual neste navegador, sem convite.'}</p>
        {participant?.registered&&<p className="participant-summary"><b>{participant.total||0} projetos avaliados</b> · {waitSeconds>0?'Pausa obrigatória':(participant.remaining??5)+' disponíveis neste lote'}</p>}
        {waitSeconds>0&&<p className="cooldown">Aguarde {Math.floor(waitSeconds/60)}:{String(waitSeconds%60).padStart(2,'0')} para continuar.</p>}
        {participant?.open===false&&<p className="muted">Última consulta: votação fechada. Atualize seu acesso para confirmar.</p>}
        {participantError&&<p className="notice" aria-live="polite">{participantError}</p>}
        </div><button className="primary" disabled={participantBusy||enviando} onClick={()=>void obterCodigo(!participant?.registered)}>{participantBusy?'Consultando…':participant?.registered?'Atualizar meu acesso':'Obter meu código'}</button>
        <small>O acesso é vinculado ao navegador, não ao endereço MAC. Não apague os dados do site.</small>
      </section>
      <nav className="tabs" aria-label="Navegação principal">
        <button className={aba==='projetos'?'active':''} disabled={enviando} onClick={()=>{setAba('projetos');setSelecionado(null)}}><Grid3X3 size={17}/> Projetos</button>
        <button className={aba==='ranking'?'active':''} disabled={enviando} onClick={()=>{setAba('ranking');setSelecionado(null)}}><Trophy size={17}/> Ranking</button>
      </nav>
      {aba==='projetos' && <section className="content">
        {selecionado ? <><button className="back" onClick={()=>setSelecionado(null)}><ArrowLeft size={16}/> Voltar aos projetos</button><article className="detail-card"><span className="eyebrow">{selecionado.modalidade}</span><h2>{selecionado.titulo}</h2><p>{selecionado.area_tematica}</p><div className="metadata"><span>{selecionado.data}</span><span>{selecionado.inicio}–{selecionado.fim}</span><span>{selecionado.local}</span></div><button className="primary" disabled={participant?.projectIds?.includes(selecionado.id)} onClick={()=>abrirAvaliacao(selecionado)}>{participant?.projectIds?.includes(selecionado.id)?"Projeto já avaliado":"Avaliar este projeto"}</button></article></> :
        <><div className="section-heading catalog-heading"><div className="catalog-intro"><span className="catalog-emblem"><Layers3 size={28} aria-hidden="true"/></span><div><p className="eyebrow">CATÁLOGO · MOSTRAS 2026</p><h2>Projetos em destaque</h2><p>Conheça as iniciativas de ensino, pesquisa, extensão e inovação.</p></div></div><span className="count catalog-count" aria-live="polite">{filtrados.length} encontrados</span></div><div className="filters catalog-filters"><div className="search"><Search size={20} aria-hidden="true"/><input aria-label="Buscar projeto" value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar projeto pelo título..." />{busca&&<button type="button" aria-label="Limpar pesquisa" className="clear-search" onClick={()=>setBusca('')}><X size={18}/></button>}</div><div className="catalog-select"><SlidersHorizontal size={18} aria-hidden="true"/><select aria-label="Filtrar por modalidade" value={modalidade} onChange={e=>setModalidade(e.target.value as typeof modalidade)}><option>Todas</option><option>Mostra Nacional</option><option>Mostra de Extensão</option></select></div></div>
        {filtrados.length ? <div className="project-grid">{filtrados.map(p=>{const {icone:Icone,tema}=temaProjeto(p);return <button className={'project-card '+(p.modalidade==='Mostra Nacional'?'nacional':'extensao')+' tema-'+tema} key={p.id} onClick={()=>setSelecionado(p)}><span className="card-kicker"><span className="project-id">{p.id}</span><span className="modality-label">{p.modalidade}</span></span><span className="project-symbol" aria-hidden="true"><Icone size={25} strokeWidth={1.7}/></span><strong>{p.titulo}</strong><span className="card-area"><Layers3 size={15} aria-hidden="true"/>{p.area_tematica}</span><span className="card-foot"><span className="project-date"><CalendarDays size={15} aria-hidden="true"/>{dataLegivel(p.data)}</span><span className="project-cta">{participant?.projectIds?.includes(p.id)?"Já avaliado · Ver projeto":"Conhecer projeto"} <ArrowRight size={15} aria-hidden="true"/></span></span></button>})}</div> : <div className="empty"><AlertCircle size={28}/><h3>{catalogo.length===0?'Catálogo oficial pendente':'Nenhum projeto encontrado'}</h3><p>{catalogo.length===0?'O catálogo oficial ainda não foi carregado pelo backend.':'Tente outro termo ou modalidade.'}</p></div>}</>}
      </section>}
      {aba==='avaliar' && <section className="content"><button className="back" disabled={enviando} onClick={()=>setAba('projetos')}><ArrowLeft size={16}/> Voltar</button><div className="section-heading"><div><p className="eyebrow">SUA PARTICIPAÇÃO</p><h2 ref={heading} tabIndex={-1}>Avaliar projeto</h2><p className="muted">{selecionado?.titulo}</p></div></div><div className="evaluation-card" aria-busy={enviando}><p className="evaluation-progress" aria-live="polite">{notas.filter(Boolean).length} de 4 critérios preenchidos</p>{!participant?.registered&&<button className="primary" disabled={participantBusy} onClick={()=>void obterCodigo(true)}>Obter meu código individual</button>}{alreadyVoted&&<p className="notice">Você já avaliou este projeto. Escolha outro.</p>}{waitSeconds>0&&<p className="notice">Pausa obrigatória após {participant?.limit||5} avaliações. Aguarde {Math.floor(waitSeconds/60)}:{String(waitSeconds%60).padStart(2,"0")}.</p>}<label className="field-label">Código individual de avaliação<input value={codigo} readOnly={!!participant?.registered} disabled={enviando||enviado||participantBusy} autoCapitalize="characters" autoComplete="off" spellCheck={false} onChange={e=>setCodigo(e.target.value.toUpperCase().replace(/\s/g,''))} placeholder="Obtenha seu código ou informe um código antigo" /></label>{CRITERIOS.map((c,i)=><div className="criterion" key={c}><div><b>{c}</b><small>Peso: {[30,30,25,15][i]}%</small></div><div className="rating" role="group" aria-label={c}>{[1,2,3,4,5].map(n=><button aria-label={`${n} - ${rotulos[n-1]}`} disabled={enviando||enviado} aria-pressed={notas[i]===n} className={notas[i]>=n?'chosen':''} key={n} onClick={()=>setNotas(old=>old.map((v,j)=>i===j?n:v))}><Star aria-hidden="true" size={20} fill={notas[i]>=n?'currentColor':'none'}/><span>{n}</span></button>)}</div><small className="muted">{notas[i] ? rotulos[notas[i]-1] : 'Selecione uma nota de 1 a 5'}</small></div>)}{participantBusy&&<p className="muted" aria-live="polite">{checkingFirstCode?'Consultando seu código. Aguarde a confirmação.':'Atualizando seu acesso em segundo plano. O servidor verificará a permissão ao enviar.'}</p>}{participant?.open===false&&<p className="notice">Na última consulta, a votação estava fechada. Ao enviar, o servidor verificará se já foi liberada.</p>}{participantError&&<p className="notice" aria-live="polite">{participantError}</p>}<div className="score-preview" aria-live="polite"><span>Prévia da nota ponderada</span><strong>{notaPrevista}</strong></div><button className="primary full" onClick={enviarAvaliacao} disabled={enviando || enviado || alreadyVoted || waitSeconds>0 || checkingFirstCode}>{enviando ? "Aguardando confirmação…" : enviado ? "Avaliação registrada" : "Enviar avaliação"}</button>{aviso && <p className="notice" aria-live="polite">{aviso}</p>}<p className="fine-print">A avaliação é educativa e indicativa, não representa nota científica oficial ou premiação do evento.</p></div></section>}
      {aba==='ranking' && <section className="content ranking-content"><div className="section-heading ranking-heading"><div className="ranking-heading-inner"><span className="ranking-emblem"><Trophy size={30} aria-hidden="true"/></span><div><p className="eyebrow">RESULTADOS DA PARTICIPAÇÃO</p><h2>Ranking por modalidade</h2><p className="muted">{modoDemonstracao ? 'Exemplo ilustrativo com notas e quantidades fictícias. Não representa avaliações reais.' : 'Médias de avaliações válidas; mínimo de cinco por projeto.'}</p></div></div></div><div className="ranking-toolbar"><button className={!modoDemonstracao?'primary':''} onClick={()=>setModoDemonstracao(false)} aria-pressed={!modoDemonstracao}>Ranking real</button><button className={modoDemonstracao?'primary':''} onClick={()=>setModoDemonstracao(true)} aria-pressed={modoDemonstracao}>Ver demonstração</button><button disabled={carregando || modoDemonstracao} onClick={()=>setAtualizacao(n=>n+1)}><RefreshCw size={16} aria-hidden="true"/> Atualizar ranking</button></div><div className="filters ranking-search"><label className="search"><Search size={18} aria-hidden="true"/><input aria-label="Buscar projeto no ranking" placeholder="Digite o título ou código do projeto" value={buscaRanking} onChange={e=>setBuscaRanking(e.target.value)}/></label>{buscaRanking && <button className="primary" onClick={()=>setBuscaRanking('')}>Limpar busca</button>}</div><p className="muted">A pesquisa preserva a posição original de cada projeto no ranking geral e na modalidade.</p>{!modoDemonstracao && rankingData && <p className="muted">Última consulta: {rankingData}</p>}{modoDemonstracao && <p role="status" className="ranking-demo-banner"><AlertCircle size={19} aria-hidden="true"/> MODO DEMONSTRAÇÃO — DADOS FICTÍCIOS. Nenhuma avaliação foi criada ou alterada.</p>}{!modoDemonstracao && carregando ? <div className="empty">Carregando ranking…</div> : !modoDemonstracao && rankingErro ? <div className="empty"><h3>Não foi possível consultar o ranking</h3><p>Tente atualizar novamente.</p></div> : <><p className="ranking-total" aria-live="polite"><BarChart3 size={18} aria-hidden="true"/>{termoRanking ? `${rankingExibido.filter(correspondeRanking).length} projeto(s) classificado(s) encontrado(s)` : `${rankingExibido.length} projetos classificados`}</p><div className="ranking-columns">{(['Geral','Mostra Nacional','Mostra de Extensão'] as const).map(tipo => {
          const itens=ordenarRanking(rankingExibido.filter(item=>tipo==='Geral'||item.modalidade===tipo));
          const visiveis=itens.filter(correspondeRanking);
          const Icone=tipo==='Geral'?Globe2:tipo==='Mostra Nacional'?GraduationCap:Users;
          return <section className={'ranking-column ranking-'+(tipo==='Geral'?'geral':tipo==='Mostra Nacional'?'nacional':'extensao')} key={tipo} aria-label={tipo}><header className="ranking-column-head"><span className="ranking-column-icon"><Icone size={23} aria-hidden="true"/></span><div><h3>{tipo}</h3><p>{itens.length} classificados{termoRanking ? ` · ${visiveis.length} encontrados` : ''}</p></div></header>{visiveis.length ? <ol className="ranking-list">{visiveis.map(item=>{
            const pos=item.posicao;
            return <li className={'rank-item rank-'+pos} key={item.id}><span className="rank-position">{pos}º{pos<=3&&(pos===1?<Trophy size={20} aria-hidden="true"/>:<Medal size={20} aria-hidden="true"/>)}</span><div className="rank-description"><strong>{item.titulo}</strong><small>{item.id} · {item.modalidade}</small><small>{item.avaliacoes} {modoDemonstracao?'avaliações fictícias':'avaliações'}</small>{item.empate&&<small className="rank-tie">Empate em média e avaliações</small>}<progress aria-label="Média do projeto" max={5} value={item.media}/></div><span className="rank-score-block"><b className="rank-score">{item.media.toFixed(2)}</b><small>de 5</small></span></li>;
          })}</ol>:<div className="empty"><h4>{termoRanking ? "Nenhum resultado nesta classificação" : "Ranking ainda não disponível"}</h4><p>{termoRanking ? "Confira o título ou código do projeto." : "Aguardando o mínimo de avaliações válidas."}</p></div>}</section>;
        })}</div>{projetosSemClassificacao.length>0 && <section className="ranking-column" style={{marginTop:16}} aria-label="Projetos sem classificação"><h3>Projetos encontrados sem posição</h3><p className="muted">{modoDemonstracao ? "Estes projetos não fazem parte do exemplo fictício." : "Ainda não possuem classificação publicada; o ranking exige o mínimo de avaliações válidas."}</p><ul className="ranking-list">{projetosSemClassificacao.map(p=><li className="rank-description" key={p.id}><strong>{p.id} · {p.titulo}</strong><small>{p.modalidade} · Sem classificação</small></li>)}</ul></section>}</> }<p className="fine-print">Ordem: média ponderada decrescente; maior número de avaliações como desempate. Em caso de empate nos dois valores, a ordem de exibição é pelo código do projeto; isso não representa superioridade na avaliação. A classificação geral é educativa, não é premiação oficial.</p></section>}
    </main>
    <footer><span>UNIVERSO IF AVALIA</span><span>Protótipo acadêmico · Não é avaliação oficial do evento</span></footer>
    <nav className="mobile-nav"><button className={aba==='projetos'?'active':''} disabled={enviando} onClick={()=>{setAba('projetos');setSelecionado(null)}}><Grid3X3/>Projetos</button><button className={aba==='ranking'?'active':''} disabled={enviando} onClick={()=>{setAba('ranking');setSelecionado(null)}}><Trophy/>Ranking</button></nav>
  </div>;
}