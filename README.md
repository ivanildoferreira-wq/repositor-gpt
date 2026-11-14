# Universo IF Avalia

Aplicação acadêmica educativa para explorar projetos e registrar avaliações. Não representa julgamento científico, votação oficial ou premiação do evento.

## Stack
- React + Vite + TypeScript
- Google Apps Script + Google Sheets
- GitHub Actions + GitHub Pages

## Desenvolvimento
```bash
npm install
npm run dev
npm test
npm run build
```

## Integração
O catálogo local contém os 46 projetos extraídos do kit oficial. O frontend usa o catálogo local como fallback e consulta o Apps Script para catálogo e ranking quando configurado. O envio de avaliações é validado no servidor, sem expor tokens administrativos no navegador.

1. Siga integralmente `docs/INTEGRACAO_APPS_SCRIPT.md` para criar a planilha, configurar o Apps Script, importar o CSV e gerar códigos.
2. Crie `.env.local` na raiz com `VITE_UNIVERSO_IF_API_URL=https://script.google.com/macros/s/SEU_ID/exec`.
3. Rode `npm install`, `npm test` e `npm run build`.
4. Só depois da validação, configure o deploy do GitHub Pages.

## Estado da implantação
- Implementação no branch `feat/universo-if-avalia-mvp`.
- `main` não alterada e site não publicado.
- Código do Apps Script preparado, mas ainda precisa ser copiado/implantado na conta Google do responsável.
- Planilha ainda precisa ser criada e configurada; nenhum código individual foi gerado.
- Build/testes não foram executados neste ambiente.

## Segurança e privacidade
- Visitantes não precisam criar conta.
- Um código individual pode avaliar vários projetos, mas só uma vez cada projeto.
- O backend armazena hash SHA-256 com pepper, nunca o código original.
- Abas de códigos e avaliações não são expostas; ranking público contém apenas agregados com mínimo de cinco avaliações por projeto.
- O código é uma credencial ao portador e não comprova identidade civil.
