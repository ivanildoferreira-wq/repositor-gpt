# Configuração inicial

## 1. Criar o projeto Google Apps Script
1. Abra https://script.google.com e crie um projeto independente.
2. Copie o ID do projeto em Configurações do projeto.
3. Na pasta apps-script, copie .clasp.json.example para .clasp.json e substitua scriptId.
4. Instale Node.js e execute npm install -g @google/clasp.
5. Execute clasp login e entre na conta Google que terá acesso às planilhas.
6. Dentro da pasta apps-script, execute clasp push.

## 2. Configurar o token
1. No editor Apps Script, abra Configurações do projeto > Propriedades do script.
2. Crie a propriedade API_TOKEN com um token aleatório forte (pelo menos 32 caracteres).
3. Não coloque esse token no GitHub nem em mensagens públicas.

O endpoint valida o token recebido no parâmetro key. O token fica na URL de configuração da Action; mantenha o GPT privado e não compartilhe essa URL. Parâmetros de URL podem aparecer em históricos de acesso, portanto use um token dedicado e rotacione-o se houver suspeita de exposição.

## 3. Implantar como aplicativo da web
1. No Apps Script, clique em Implantar > Nova implantação.
2. Tipo: Aplicativo da web.
3. Executar como: sua conta Google.
4. Acesso: qualquer pessoa (o token da aplicação é validado pelo código).
5. Autorize os escopos solicitados e conclua a implantação.
6. Copie a URL terminada em /exec.

## 4. Conectar uma GPT Action
1. Abra openai/actions-openapi.yaml.
2. Substitua COLE_A_URL_DE_IMPLANTACAO pela URL de implantação e COLE_SEU_TOKEN pelo token configurado.
3. No editor de GPT, crie uma Action e cole o YAML.
4. Adicione as instruções de openai/instructions.md.
5. Teste primeiro com uma leitura de uma planilha de teste.

## 5. Teste de leitura
Envie à Action:
{
  "action": "listSheets",
  "spreadsheetId": "ID_DA_PLANILHA"
}

## Operações disponíveis
- listSheets: lista as abas e dimensões.
- readRange: lê intervalo A1.
- writeRange: grava uma matriz bidimensional em um intervalo do mesmo tamanho.
- appendRows: acrescenta linhas ao final dos dados.
- createSheet: cria uma aba.
- createSpreadsheet: cria uma nova planilha.

## Limites e cuidados
- Até 10.000 células por chamada de leitura ou escrita.
- A conta Google que executa o Apps Script precisa ter acesso à planilha.
- O aplicativo web executa como o proprietário, portanto as operações usam as permissões dessa conta.
- A URL do Web App e o token são configuração local, não devem ser commitados.
- Para maior segurança em ambientes compartilhados, use um proxy autenticado entre a Action e o Apps Script; o Apps Script não expõe cabeçalhos HTTP recebidos no objeto de evento padrão.
