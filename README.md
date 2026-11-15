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

## Estado da implantação (verificado em 14/11/2026)
- Aplicação publicada no GitHub Pages: https://ivanildoferreira-wq.github.io/repositor-gpt/
- Código-fonte principal no branch `main`, com deploy via GitHub Actions.
- Google Apps Script implantado e integrado à planilha Google Sheets.
- Catálogo de 46 projetos e ranking demonstrativo verificados na interface.
- Envio de avaliações validado ponta a ponta: confirmação de sucesso no site e registro correspondente na aba `Avaliacoes`.
- Quatro avaliações de teste registradas até a verificação; não são dados de demonstração do ranking.
- Votação encerrada após o teste (`Configuracao!B2 = FALSE`).
- Ranking real exibe somente projetos com pelo menos cinco avaliações válidas (`minimo_ranking = 5`); portanto pode ficar vazio até atingir esse limite.

### Operação e novos testes
1. Mantenha `votacao_aberta` em `FALSE` fora do período autorizado de avaliação.
2. Para um teste controlado, abra a votação temporariamente e use um código válido em um projeto ainda não avaliado por esse código.
3. Envie apenas uma vez e aguarde a confirmação; em caso de erro, confira a aba `Avaliacoes` antes de repetir.
4. Encerre a votação imediatamente após o teste.
5. Não publique códigos individuais, hashes, `CODE_PEPPER`, `API_TOKEN` ou o conteúdo privado das abas.

## Segurança e privacidade
- Visitantes não precisam criar conta.
- Um código individual pode avaliar vários projetos, mas só uma vez cada projeto.
- O backend armazena hash SHA-256 com pepper, nunca o código original.
- Abas de códigos e avaliações não são expostas; ranking público contém apenas agregados com mínimo de cinco avaliações por projeto.
- O código é uma credencial ao portador e não comprova identidade civil.
