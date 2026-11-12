# Integração Google Sheets + Apps Script

O backend de avaliações foi adicionado em `apps-script/Code.gs`. Ele oferece leitura pública apenas do catálogo e do ranking agregado; o envio de voto é validado no servidor. A API administrativa legada continua protegida por `API_TOKEN`.

## 1. Criar a planilha privada
1. Na conta Google que será proprietária dos dados, crie uma planilha chamada **Universo IF Avalia — Dados**.
2. Copie o ID entre `/d/` e `/edit` na URL.
3. Não compartilhe a planilha publicamente.

## 2. Configurar Apps Script
1. Acesse https://script.google.com e crie um projeto.
2. Cole o conteúdo atualizado de `apps-script/Code.gs` no arquivo `Code.gs`.
3. Em **Configurações do projeto → Propriedades do script**, configure:
   - `SPREADSHEET_ID`: ID da planilha privada.
   - `CODE_PEPPER`: segredo aleatório forte, exclusivo e permanente (mínimo recomendado de 32 bytes).
   - `API_TOKEN`: somente se ainda utilizar a API administrativa antiga; nunca no frontend.
4. Salve. No seletor de funções, execute `setupUniversoIF` uma vez e autorize o acesso à planilha.

## 3. Importar os 46 projetos
1. Na aba `Projetos`, mantenha a primeira linha criada pelo setup.
2. No Google Sheets, use **Arquivo → Importar → Fazer upload** e selecione o CSV oficial `universo_if_catalogo_46_projetos_v1.0.csv` que está no kit ZIP.
3. Escolha **Inserir novas linhas** e separador **ponto e vírgula**. Importe a partir da linha 2, preservando os cabeçalhos.
4. A ordem das colunas deve ser: `id, titulo, modalidade, area_tematica, data, inicio, fim, formato, local, fontes_paginas`.
5. Confirme 46 linhas de projetos, sem cabeçalho duplicado. Não altere os IDs NAC-001…NAC-024 e EXT-001…EXT-022.

## 4. Criar códigos individuais
1. No Apps Script, execute manualmente `gerarCodigosUniversoIF` com a quantidade necessária (1 a 5000).
2. Copie os códigos retornados no registro da execução e distribua individualmente aos participantes por canal privado.
3. Guarde a lista original em local seguro. A planilha armazena apenas hashes SHA-256 com pepper; não é possível recuperar o código original a partir dela.
4. Não execute a geração novamente para a mesma distribuição, a menos que queira emitir um lote adicional.

## 5. Publicar o Web App
1. **Implantar → Nova implantação → Aplicativo da web**.
2. Executar como: sua conta Google.
3. Acesso: qualquer pessoa. O endpoint público só permite catálogo, ranking agregado e envio de avaliação com código válido.
4. Conclua a autorização e copie a URL terminada em `/exec`.
5. A implantação é responsabilidade do proprietário da conta Google. Não publique a URL administrativa com `API_TOKEN`.

## 6. Conectar o frontend
1. Na raiz do projeto, crie `.env.local` com:
   `VITE_UNIVERSO_IF_API_URL=https://script.google.com/macros/s/SEU_ID/exec`
2. Nunca adicione `.env.local` ao Git. O endpoint do Web App não é senha; os códigos e o pepper não devem ser colocados no frontend.
3. Execute `npm ci`, `npm test` e `npm run build`.
4. Para desenvolvimento, execute `npm run dev`. Para publicar no GitHub Pages, configure a variável de ambiente no processo de build e publique somente depois dos testes.

## Endpoints
- `GET ?action=projects&callback=...`: catálogo público, sem dados de códigos ou votos.
- `GET ?action=ranking&callback=...`: médias e quantidades agregadas; somente projetos com pelo menos cinco avaliações.
- `POST publicAction=submitEvaluation`: envio por formulário em iframe, sem token secreto no navegador.

## Regras implementadas
- Quatro notas inteiras de 1 a 5; pesos 30%, 30%, 25% e 15%.
- Código normalizado e validado no servidor; planilha guarda somente hash SHA-256 com pepper.
- Um código pode avaliar projetos diferentes, mas não repetir o mesmo projeto.
- `LockService` serializa a verificação e a gravação para impedir duplicidade concorrente.
- Requisições repetidas com o mesmo identificador e mesmos dados são idempotentes.
- Ranking é agregado, separado por modalidade e exige mínimo configurado de cinco avaliações por projeto.
- A aba `Codigos` e a aba `Avaliacoes` nunca são retornadas por endpoints públicos.

## Limitações e validação antes de abrir ao público
- O Apps Script e a planilha ainda precisam ser criados e implantados na conta Google do responsável; isso não pode ser feito sem autorização/acesso à conta.
- Faça um teste com um código de teste, duas avaliações em projetos diferentes e uma tentativa duplicada no mesmo projeto.
- Teste também código inexistente, código desativado, votação fechada e ranking abaixo/acima de cinco avaliações.
- O código individual funciona como credencial ao portador; não comprova a identidade civil do participante.
- O sistema é atividade acadêmica educativa, não avaliação ou premiação oficial do evento.
