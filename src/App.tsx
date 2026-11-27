import { useEffect, useMemo, useState, useRef } from 'react';
import { carregarProjetos, carregarRanking, enviarAvaliacao as enviarAvaliacaoApi } from './api';
import { Search, Grid3X3, Trophy, ArrowLeft, Star, AlertCircle, Layers3, BookOpen, Users, Leaf, Cpu, FlaskConical, GraduationCap, CalendarDays, ArrowRight, SlidersHorizontal, X, Brain } from 'lucide-react';
import rawCatalog from './catalogo.json';
import { calcularNota, CRITERIOS, normalizarBusca, validarCatalogo, type Projeto, type Modalidade } from './domain';

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
  const envioEmCurso = useRef(false);
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

  const filtrados = useMemo(() => catalogo.filter(p =>
    (modalidade === 'Todas' || p.modalidade === modalidade) &&
    normalizarBusca([p.titulo,p.id,p.area_tematica].join(' ')).includes(normalizarBusca(busca))
  ), [catalogo, busca, modalidade]);

  const notaPrevista = notas.every(n => n >= 1) ? calcularNota(notas).toFixed(2) : '—';
  const rankingExibido = modoDemonstracao ? gerarRankingDemonstracao(catalogo) : ranking;

  const termoRanking = normalizarBusca(buscaRanking);
  const correspondeRanking = (item: {id:string;titulo:string;modalidade:Modalidade}) => normalizarBusca([item.id,item.titulo,item.modalidade].join(' ')).includes(termoRanking);
  const projetosSemClassificacao = termoRanking ? catalogo.filter(p=>correspondeRanking(p)&&!rankingExibido.some(r=>r.id===p.id)) : [];

  function abrirAvaliacao(projeto: Projeto) {
    setSelecionado(projeto); setNotas([0, 0, 0, 0]); setCodigo(''); setAviso(''); setEnviando(false); setEnviado(false); setAba('avaliar');
  }

  async function enviarAvaliacao() {
    if (envioEmCurso.current || enviado) return;
    if (!selecionado || !codigo.trim() || notas.some(n => n < 1 || n > 5)) {
      setAviso('Preencha o código e os quatro critérios antes de continuar.'); return;
    }
    if (!/^[A-F0-9]{12}$/.test(codigo.replace(/\s/g,'').toUpperCase())) {setAviso('Informe um código válido de 12 caracteres (A–F e 0–9).'); return;}
    envioEmCurso.current=true;
    setEnviando(true);
    setAviso('Enviando avaliação…');
    try {
      const result = await enviarAvaliacaoApi({requestId: crypto.randomUUID().replace(/-/g,''), projectId: selecionado.id, code: codigo.trim(), scores: notas});
      setAviso(result.message + ' Nota registrada: ' + result.score.toFixed(2) + '.');
      setEnviado(true);
    } catch (error) { setAviso(error instanceof Error ? error.message : 'Não foi possível enviar a avaliação.'); }
    finally { envioEmCurso.current=false; setEnviando(false); }
  }

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#inicio" onClick={e => {if(enviando){e.preventDefault();return;}setAba('projetos');setSelecionado(null)}}><span className="brand-mark">IF</span><span>UNIVERSO <b>IF AVALIA</b><small>PARTICIPAÇÃO POPULAR EDUCATIVA</small></span></a><span className="academic-tag">PROJETO ACADÊMICO · 2026.2</span></header>
    <main>
      <section className="hero"><div><p className="eyebrow">IFMA · MOSTRAS 2026</p><h1>Ideias que transformam.<br/><em>Conheça e avalie.</em></h1><p className="hero-copy">Explore os projetos apresentados e participe desta experiência educativa.</p></div><div className="hero-stamp"><span>{catalogo.length}</span><small>PROJETOS<br/>PREVISTOS</small></div></section>
      <section aria-label="Participação" style={{display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:12,padding:'16px 20px',margin:'16px 0',border:'1px solid #b7d9c7',borderRadius:16,background:'#eaf7ef',color:'#164b32'}}><div><strong>Seu acesso à experiência científica</strong><p style={{margin:'4px 0'}}>Resgate um convite individual entregue pela organização.</p></div><a className="primary" style={{textDecoration:'none'}} href="https://script.google.com/a/macros/acad.ifma.edu.br/s/AKfycbzMZr-e8DNX2QZ9v6NCUZSXb-AOvkY6LhnBA5l-V3bdnn8OLclWjGlFxEq0VEdxHH0_/exec?action=codePage" target="_blank" rel="noopener noreferrer">Obter meu código</a></section>
      <nav className="tabs" aria-label="Navegação principal">
        <button className={aba==='projetos'?'active':''} disabled={enviando} onClick={()=>{setAba('projetos');setSelecionado(null)}}><Grid3X3 size={17}/> Projetos</button>
        <button className={aba==='ranking'?'active':''} disabled={enviando} onClick={()=>{setAba('ranking');setSelecionado(null)}}><Trophy size={17}/> Ranking</button>
      </nav>
      {aba==='projetos' && <section className="content">
        {selecionado ? <><button className="back" onClick={()=>setSelecionado(null)}><ArrowLeft size={16}/> Voltar aos projetos</button><article className="detail-card"><span className="eyebrow">{selecionado.modalidade}</span><h2>{selecionado.titulo}</h2><p>{selecionado.area_tematica}</p><div className="metadata"><span>{selecionado.data}</span><span>{selecionado.inicio}–{selecionado.fim}</span><span>{selecionado.local}</span></div><button className="primary" onClick={()=>abrirAvaliacao(selecionado)}>Avaliar este projeto</button></article></> :
        <><div className="section-heading catalog-heading"><div className="catalog-intro"><span className="catalog-emblem"><Layers3 size={28} aria-hidden="true"/></span><div><p className="eyebrow">CATÁLOGO · MOSTRAS 2026</p><h2>Projetos em destaque</h2><p>Conheça as iniciativas de ensino, pesquisa, extensão e inovação.</p></div></div><span className="count catalog-count" aria-live="polite">{filtrados.length} encontrados</span></div><div className="filters catalog-filters"><label className="search"><Search size={20} aria-hidden="true"/><input aria-label="Buscar projeto" value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar projeto pelo título..." />{busca&&<button type="button" aria-label="Limpar pesquisa" className="clear-search" onClick={()=>setBusca('')}><X size={18}/></button>}</label><div className="catalog-select"><SlidersHorizontal size={18} aria-hidden="true"/><select aria-label="Filtrar por modalidade" value={modalidade} onChange={e=>setModalidade(e.target.value as typeof modalidade)}><option>Todas</option><option>Mostra Nacional</option><option>Mostra de Extensão</option></select></div></div>
        {filtrados.length ? <div className="project-grid">{filtrados.map(p=>{const {icone:Icone,tema}=temaProjeto(p);return <button className={'project-card '+(p.modalidade==='Mostra Nacional'?'nacional':'extensao')+' tema-'+tema} key={p.id} onClick={()=>setSelecionado(p)}><span className="card-kicker"><span className="project-id">{p.id}</span><span className="modality-label">{p.modalidade}</span></span><span className="project-symbol" aria-hidden="true"><Icone size={25} strokeWidth={1.7}/></span><strong>{p.titulo}</strong><span className="card-area"><Layers3 size={15} aria-hidden="true"/>{p.area_tematica}</span><span className="card-foot"><span className="project-date"><CalendarDays size={15} aria-hidden="true"/>{dataLegivel(p.data)}</span><span className="project-cta">Conhecer projeto <ArrowRight size={15} aria-hidden="true"/></span></span></button>})}</div> : <div className="empty"><AlertCircle size={28}/><h3>{catalogo.length===0?'Catálogo oficial pendente':'Nenhum projeto encontrado'}</h3><p>{catalogo.length===0?'O catálogo oficial ainda não foi carregado pelo backend.':'Tente outro termo ou modalidade.'}</p></div>}</>}
      </section>}
      {aba==='avaliar' && <section className="content"><button className="back" disabled={enviando} onClick={()=>setAba('projetos')}><ArrowLeft size={16}/> Voltar</button><div className="section-heading"><div><p className="eyebrow">SUA PARTICIPAÇÃO</p><h2 ref={heading} tabIndex={-1}>Avaliar projeto</h2><p className="muted">{selecionado?.titulo}</p></div></div><div className="evaluation-card" aria-busy={enviando}><p className="evaluation-progress" aria-live="polite">{notas.filter(Boolean).length} de 4 critérios preenchidos</p><label className="field-label">Código individual de avaliação<input value={codigo} disabled={enviando||enviado} autoCapitalize="characters" autoComplete="off" spellCheck={false} onChange={e=>setCodigo(e.target.value.toUpperCase().replace(/\s/g,''))} placeholder="Digite o código fornecido pela organização" /></label>{CRITERIOS.map((c,i)=><div className="criterion" key={c}><div><b>{c}</b><small>Peso: {[30,30,25,15][i]}%</small></div><div className="rating" role="group" aria-label={c}>{[1,2,3,4,5].map(n=><button aria-label={`${n} - ${rotulos[n-1]}`} disabled={enviando||enviado} aria-pressed={notas[i]===n} className={notas[i]>=n?'chosen':''} key={n} onClick={()=>setNotas(old=>old.map((v,j)=>i===j?n:v))}><Star aria-hidden="true" size={20} fill={notas[i]>=n?'currentColor':'none'}/><span>{n}</span></button>)}</div><small className="muted">{notas[i] ? rotulos[notas[i]-1] : 'Selecione uma nota de 1 a 5'}</small></div>)}<div className="score-preview" aria-live="polite"><span>Prévia da nota ponderada</span><strong>{notaPrevista}</strong></div><button className="primary full" onClick={enviarAvaliacao} disabled={enviando || enviado}>{enviando ? "Aguardando confirmação…" : enviado ? "Avaliação registrada" : "Enviar avaliação"}</button>{aviso && <p className="notice" aria-live="polite">{aviso}</p>}<p className="fine-print">A avaliação é educativa e indicativa, não representa nota científica oficial ou premiação do evento.</p></div></section>}
      {aba==='ranking' && <section className="content"><div className="section-heading"><div><p className="eyebrow">RESULTADOS DA PARTICIPAÇÃO</p><h2>Ranking por modalidade</h2><p className="muted">{modoDemonstracao ? 'Exemplo ilustrativo com notas e quantidades fictícias. Não representa avaliações reais.' : 'Médias de avaliações válidas; mínimo de cinco por projeto.'}</p></div></div><div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:20}}><button className={!modoDemonstracao?'primary':''} onClick={()=>setModoDemonstracao(false)} aria-pressed={!modoDemonstracao}>Ranking real</button><button className={modoDemonstracao?'primary':''} onClick={()=>setModoDemonstracao(true)} aria-pressed={modoDemonstracao}>Ver demonstração</button><button disabled={carregando || modoDemonstracao} onClick={()=>setAtualizacao(n=>n+1)}>Atualizar ranking</button></div><div className="filters ranking-search"><label className="search"><Search size={18} aria-hidden="true"/><input aria-label="Buscar projeto no ranking" placeholder="Digite o título ou código do projeto" value={buscaRanking} onChange={e=>setBuscaRanking(e.target.value)}/></label>{buscaRanking && <button className="primary" onClick={()=>setBuscaRanking('')}>Limpar busca</button>}</div><p className="muted">A pesquisa preserva a posição original de cada projeto no ranking geral e na modalidade.</p>{!modoDemonstracao && rankingData && <p className="muted">Última consulta: {rankingData}</p>}{modoDemonstracao && <p role="status" style={{padding:'12px 16px',border:'2px dashed currentColor',borderRadius:10,marginBottom:20,fontWeight:700}}>MODO DEMONSTRAÇÃO — DADOS FICTÍCIOS. Nenhuma avaliação foi criada ou alterada.</p>}{!modoDemonstracao && carregando ? <div className="empty">Carregando ranking…</div> : !modoDemonstracao && rankingErro ? <div className="empty"><h3>Não foi possível consultar o ranking</h3><p>Tente atualizar novamente.</p></div> : <><p className="muted" aria-live="polite">{termoRanking ? `${rankingExibido.filter(correspondeRanking).length} projeto(s) classificado(s) encontrado(s)` : `${rankingExibido.length} projetos classificados`}</p><div className="ranking-columns">{(['Geral','Mostra Nacional','Mostra de Extensão'] as const).map(tipo => {
          const itens=rankingExibido.filter(item=>tipo==='Geral'||item.modalidade===tipo).sort((a,b)=>b.media-a.media||b.avaliacoes-a.avaliacoes||a.id.localeCompare(b.id));
          const visiveis=itens.filter(correspondeRanking);
          return <section className="ranking-column" key={tipo} aria-label={tipo}><h3>{tipo}</h3><p className="muted">{itens.length} classificados{termoRanking ? ` · ${visiveis.length} encontrados` : ''}</p>{visiveis.length ? <ol className="ranking-list">{visiveis.map(item=>{
            const pos=itens.findIndex(x=>x.media===item.media&&x.avaliacoes===item.avaliacoes)+1;
            return <li className={'rank-item rank-'+pos} key={item.id}><span className="rank-position">{pos}º{pos<=3&&<Trophy size={19} aria-hidden="true"/>}</span><div className="rank-description"><strong>{item.titulo}</strong><small>{item.id} · {item.modalidade}</small><small>{item.avaliacoes} {modoDemonstracao?'avaliações fictícias':'avaliações'}</small><progress aria-label="Média do projeto" max={5} value={item.media}/></div><b className="rank-score">{item.media.toFixed(2)}</b></li>;
          })}</ol>:<div className="empty"><h4>{termoRanking ? "Nenhum resultado nesta classificação" : "Ranking ainda não disponível"}</h4><p>{termoRanking ? "Confira o título ou código do projeto." : "Aguardando o mínimo de avaliações válidas."}</p></div>}</section>;
        })}</div>{projetosSemClassificacao.length>0 && <section className="ranking-column" style={{marginTop:16}} aria-label="Projetos sem classificação"><h3>Projetos encontrados sem posição</h3><p className="muted">{modoDemonstracao ? "Estes projetos não fazem parte do exemplo fictício." : "Ainda não possuem classificação publicada; o ranking exige o mínimo de avaliações válidas."}</p><ul className="ranking-list">{projetosSemClassificacao.map(p=><li className="rank-description" key={p.id}><strong>{p.id} · {p.titulo}</strong><small>{p.modalidade} · Sem classificação</small></li>)}</ul></section>}</> }<p className="fine-print">Ordem: média ponderada decrescente; maior número de avaliações como desempate. Empates nos dois valores compartilham a posição. A classificação geral é educativa, não é premiação oficial.</p></section>}
    </main>
    <footer><span>UNIVERSO IF AVALIA</span><span>Protótipo acadêmico · Não é avaliação oficial do evento</span></footer>
    <nav className="mobile-nav"><button className={aba==='projetos'?'active':''} disabled={enviando} onClick={()=>{setAba('projetos');setSelecionado(null)}}><Grid3X3/>Projetos</button><button className={aba==='ranking'?'active':''} disabled={enviando} onClick={()=>{setAba('ranking');setSelecionado(null)}}><Trophy/>Ranking</button></nav>
  </div>;
}