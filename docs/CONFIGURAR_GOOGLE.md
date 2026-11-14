# Configurar Google Sheets e Apps Script

Esta etapa ainda não foi implantada. A conta Google da equipe deve ser proprietária da planilha e do projeto Apps Script.

## Estrutura planejada da planilha
Criar abas privadas:
- `Projetos`: catálogo oficial importado do JSON.
- `Codigos`: hashes SHA-256 dos códigos individuais e estado.
- `Avaliacoes`: request_id, hash_codigo, id_projeto, quatro notas, nota ponderada, timestamp e estado.
- `Configuracao`: votação aberta/fechada, período, mínimo do ranking (5) e versão do catálogo.

## Regras obrigatórias do backend
- Não expor abas Codigos ou Avaliacoes em endpoints públicos.
- Validar o código no servidor em cada envio; armazenar somente seu hash.
- Usar LockService para verificar e gravar atomicamente o par (hash_codigo, id_projeto).
- Mesmo código pode avaliar projetos diferentes, mas não repetir o mesmo projeto.
- Recalcular a nota ponderada no servidor.
- Implementar idempotência por id_requisicao e só confirmar depois de recibo confiável.
- Ranking público contém somente agregados, separado por modalidade e com mínimo de cinco avaliações.
- Nunca usar `no-cors` como confirmação de envio.

## Implantação
Quando o backend estiver pronto, criar uma planilha e um Apps Script na conta da equipe, configurar as propriedades privadas e validar as permissões institucionais. Não publicar tokens, códigos válidos ou planilha.
