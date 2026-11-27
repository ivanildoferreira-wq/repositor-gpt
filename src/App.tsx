import { useEffect, useMemo, useState } from 'react';
import { carregarProjetos, carregarRanking, enviarAvaliacao as enviarAvaliacaoApi } from './api';
import { Search, Grid3X3, Trophy, ArrowLeft, Star, AlertCircle } from 'lucide-react';
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
  const [modalidade, setModalidade] = useState<'Todas' | Modalidade>('Todas');
  const [selecionado, setSelecionado] = useState<Projeto | null>(null);
  const [notas, setNotas] = useState<number[]>([0, 0, 0, 0]);
  const [codigo, setCodigo] = useState('');
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

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
    normalizarBusca(p.titulo).includes(normalizarBusca(busca))
  ), [busca, modalidade]);

  const notaPrevista = notas.every(n => n >= 1) ? calcularNota(notas).toFixed(2) : '—';
  const rankingExibido = modoDemonstracao ? gerarRankingDemonstracao(catalogo) : ranking;

  function abrirAvaliacao(projeto: Projeto) {
    setSelecionado(projeto); setNotas([0, 0, 0, 0]); setCodigo(''); setAviso(''); setEnviando(false); setEnviado(false); setAba('avaliar');
  }

  async function enviarAvaliacao() {
    if (enviando || enviado) return;
    if (!selecionado || !codigo.trim() || notas.some(n => n < 1 || n > 5)) {
      setAviso('Preencha o código e os quatro critérios antes de continuar.'); return;
    }
    setEnviando(true);
    setAviso('Enviando avaliação…');
    try {
      const result = await enviarAvaliacaoApi({requestId: crypto.randomUUID().replace(/-/g,''), projectId: selecionado.id, code: codigo.trim(), scores: notas});
      setAviso(result.message + ' Nota registrada: ' + result.score.toFixed(2) + '.');
      setEnviado(true);
    } catch (error) { setAviso(error instanceof Error ? error.message : 'Não foi possível enviar a avaliação.'); }
    finally { setEnviando(false); }
  }

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#inicio" onClick={() => {setAba('projetos');setSelecionado(null)}}><span className="brand-mark">IF</span><span>UNIVERSO <b>IF AVALIA</b><small>PARTICIPAÇÃO POPULAR EDUCATIVA</small></span></a><span className="academic-tag">PROJETO ACADÊMICO · 2026.2</span></header>
    <main>
      <section className="hero"><div><p className="eyebrow">IFMA · MOSTRAS 2026</p><h1>Ideias que transformam.<br/><em>Conheça e avalie.</em></h1><p className="hero-copy">Explore os projetos apresentados e participe desta experiência educativa.</p></div><div className="hero-stamp"><span>{catalogo.length}</span><small>PROJETOS<br/>PREVISTOS</small></div></section>
      <section aria-label="Participação" style={{display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:12,padding:'16px 20px',margin:'16px 0',border:'1px solid #b7d9c7',borderRadius:16,background:'#eaf7ef',color:'#164b32'}}><div><strong>Seu acesso à experiência científica</strong><p style={{margin:'4px 0'}}>Resgate um convite individual entregue pela organização.</p></div><a className="primary" style={{textDecoration:'none'}} href="https://script.google.com/a/macros/acad.ifma.edu.br/s/AKfycbzMZr-e8DNX2QZ9v6NCUZSXb-AOvkY6LhnBA5l-V3bdnn8OLclWjGlFxEq0VEdxHH0_/exec?action=codePage" target="_blank" rel="noopener noreferrer">Obter meu código</a></section>
      <nav className="tabs" aria-label="Navegação principal">
        <button className={aba==='projetos'?'active':''} onClick={()=>{setAba('projetos');setSelecionado(null)}}><Grid3X3 size={17}/> Projetos</button>
        <button className={aba==='ranking'?'active':''} onClick={()=>{setAba('ranking');setSelecionado(null)}}><Trophy size={17}/> Ranking</button>
      </nav>
      {aba==='projetos' && <section className="content">
        {selecionado ? <><button className="back" onClick={()=>setSelecionado(null)}><ArrowLeft size={16}/> Voltar aos projetos</button><article className="detail-card"><span className="eyebrow">{selecionado.modalidade}</span><h2>{selecionado.titulo}</h2><p>{selecionado.area_tematica}</p><div className="metadata"><span>{selecionado.data}</span><span>{selecionado.inicio}–{selecionado.fim}</span><span>{selecionado.local}</span></div><button className="primary" onClick={()=>abrirAvaliacao(selecionado)}>Avaliar este projeto</button></article></> :
        <><div className="section-heading"><div><p className="eyebrow">CATÁLOGO</p><h2>Projetos em destaque</h2></div><span className="count">{filtrados.length} encontrados</span></div><div className="filters"><label className="search"><Search size={18}/><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar projeto pelo título..." /></label><select value={modalidade} onChange={e=>setModalidade(e.target.value as typeof modalidade)}><option>Todas</option><option>Mostra Nacional</option><option>Mostra de Extensão</option></select></div>
        {filtrados.length ? <div className="project-grid">{filtrados.map(p=><button className="project-card" key={p.id} onClick={()=>setSelecionado(p)}><span className="card-kicker">{p.id} · {p.modalidade}</span><strong>{p.titulo}</strong><span className="card-area">{p.area_tematica}</span><span className="card-foot">{p.data} <span>Conhecer projeto ↗</span></span></button>)}</div> : <div className="empty"><AlertCircle size={28}/><h3>{catalogo.length===0?'Catálogo oficial pendente':'Nenhum projeto encontrado'}</h3><p>{catalogo.length===0?'O catálogo oficial ainda não foi carregado pelo backend.':'Tente outro termo ou modalidade.'}</p></div>}</>}
      </section>}
      {aba==='avaliar' && <section className="content"><button className="back" onClick={()=>setAba('projetos')}><ArrowLeft size={16}/> Voltar</button><div className="section-heading"><div><p className="eyebrow">SUA PARTICIPAÇÃO</p><h2>Avaliar projeto</h2><p className="muted">{selecionado?.titulo}</p></div></div><div className="evaluation-card"><label className="field-label">Código individual de avaliação<input value={codigo} onChange={e=>setCodigo(e.target.value)} placeholder="Digite o código fornecido pela organização" /></label>{CRITERIOS.map((c,i)=><div className="criterion" key={c}><div><b>{c}</b><small>Peso: {[30,30,25,15][i]}%</small></div><div className="rating">{[1,2,3,4,5].map(n=><button aria-label={`${n} - ${rotulos[n-1]}`} aria-pressed={notas[i]===n} className={notas[i]>=n?'chosen':''} key={n} onClick={()=>setNotas(old=>old.map((v,j)=>i===j?n:v))}><Star size={17} fill={notas[i]>=n?'currentColor':'none'}/></button>)}</div><small className="muted">{notas[i] ? rotulos[notas[i]-1] : 'Selecione uma nota de 1 a 5'}</small></div>)}<div className="score-preview"><span>Prévia da nota ponderada</span><strong>{notaPrevista}</strong></div><button className="primary full" onClick={enviarAvaliacao} disabled={enviando || enviado}>{enviando ? "Aguardando confirmação…" : enviado ? "Avaliação registrada" : "Enviar avaliação"}</button>{aviso && <p className="notice">{aviso}</p>}<p className="fine-print">A avaliação é educativa e indicativa, não representa nota científica oficial ou premiação do evento.</p></div></section>}
      {aba==='ranking' && <section className="content"><div className="section-heading"><div><p className="eyebrow">RESULTADOS DA PARTICIPAÇÃO</p><h2>Ranking por modalidade</h2><p className="muted">{modoDemonstracao ? 'Exemplo ilustrativo com notas e quantidades fictícias. Não representa avaliações reais.' : 'Médias de avaliações válidas; mínimo de cinco por projeto.'}</p></div></div><div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:20}}><button className={!modoDemonstracao?'primary':''} onClick={()=>setModoDemonstracao(false)} aria-pressed={!modoDemonstracao}>Ranking real</button><button className={modoDemonstracao?'primary':''} onClick={()=>setModoDemonstracao(true)} aria-pressed={modoDemonstracao}>Ver demonstração</button><button disabled={carregando || modoDemonstracao} onClick={()=>setAtualizacao(n=>n+1)}>Atualizar ranking</button></div>{!modoDemonstracao && rankingData && <p className="muted">Última consulta: {rankingData}</p>}{modoDemonstracao && <p role="status" style={{padding:'12px 16px',border:'2px dashed currentColor',borderRadius:10,marginBottom:20,fontWeight:700}}>MODO DEMONSTRAÇÃO — DADOS FICTÍCIOS. Nenhuma avaliação foi criada ou alterada.</p>}{!modoDemonstracao && carregando ? <div className="empty">Carregando ranking…</div> : !modoDemonstracao && rankingErro ? <div className="empty"><h3>Não foi possível consultar o ranking</h3><p>Tente atualizar novamente.</p></div> : rankingExibido.length ? (['Mostra Nacional','Mostra de Extensão'] as Modalidade[]).map(tipo => { const itens=rankingExibido.filter(item=>item.modalidade===tipo); return <section key={tipo}><div className="section-heading"><h3>{tipo}</h3><span className="count">{itens.length} classificados</span></div>{itens.length ? <div className="project-grid">{itens.map((item,i)=><article className="project-card" key={item.id} style={{borderLeft:i===0?'5px solid #b58b32':undefined}}><span className="card-kicker">#{i+1} · {item.avaliacoes} {modoDemonstracao ? "avaliações fictícias" : "avaliações"}</span><strong>{item.titulo}</strong><span className="card-area">Média {item.media.toFixed(2)} / 5</span><progress aria-label="Média do projeto" max={5} value={item.media} style={{width:'100%',accentColor:'#16834c'}}/></article>)}</div> : <p className="muted">Nenhum projeto desta modalidade atingiu cinco avaliações válidas.</p>}</section>; }) : <div className="empty"><Trophy size={30}/><h3>Ranking ainda não disponível</h3><p>Os projetos aparecem após atingir o mínimo de cinco avaliações válidas por projeto.</p></div>}</section>}
    </main>
    <footer><span>UNIVERSO IF AVALIA</span><span>Protótipo acadêmico · Não é avaliação oficial do evento</span></footer>
    <nav className="mobile-nav"><button className={aba==='projetos'?'active':''} onClick={()=>{setAba('projetos');setSelecionado(null)}}><Grid3X3/>Projetos</button><button className={aba==='ranking'?'active':''} onClick={()=>setAba('ranking')}><Trophy/>Ranking</button></nav>
  </div>;
}