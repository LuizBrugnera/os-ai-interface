// ai-agent-loop.js — versão 4
// ---------------------------------------------------------------------------
// Dois agentes: Builder 🛠️  e Tester 🔍  iteram até gerar um projeto funcional.
// Esta versão:
//   • Importa a lista de ferramentas a partir de ./tools.js  (fonte única).
//   • Garante que TODO o código seja gerado dentro da pasta  ../resultados ,
//     que fica no mesmo nível da pasta os-ai.
// ---------------------------------------------------------------------------
// Uso:  node ai-agent-loop.js "<plano em linguagem natural>"
// ---------------------------------------------------------------------------

import { OpenAI } from "openai";
import { runCommand } from "./cli-fs-shell.js";
import { tools } from "./tools.js"; // <- lista única de ferramentas
import "dotenv/config";

/*************** 1. Workspace: ../resultados *********************************/
// Sempre trabalharemos dentro de "../resultados". Se não existir, criamos.
async function enterResultados() {
  try {
    await runCommand("mkdir ../../resultados");
  } catch (_) {
    /* já existe */
  }
  await runCommand("cd ../../resultados");
}

/*************** 2. Auxiliar: converte tool_call → linha *********************/
function toolCallToLine(call) {
  const args = JSON.parse(call.function.arguments || "{}");
  const parts = [call.function.name];
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === "boolean") {
      if (v) parts.push(`--${k}`);
    } else {
      parts.push(String(v));
    }
  }
  return parts.join(" ");
}

/*************** 3. Motor de conversa ****************************************/
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = "gpt-4o-mini";

async function chat(roleName, systemPrompt, userPrompt, carry = []) {
  const messages = [
    { role: "system", name: roleName, content: systemPrompt },
    { role: "user", content: userPrompt },
    ...carry,
  ];

  let finalText = "";
  while (true) {
    const r = await openai.chat.completions.create({
      model: MODEL,
      messages,
      tools,
      tool_choice: "auto",
    });
    const m = r.choices[0].message;

    if (m.tool_calls?.length) {
      messages.push(m);
      for (const c of m.tool_calls) {
        if (c.type !== "function") continue;
        let out;
        try {
          out = await runCommand(toolCallToLine(c));
        } catch (e) {
          out = `Erro: ${e.message}`;
        }
        messages.push({
          role: "tool",
          name: c.function.name,
          tool_call_id: c.id,
          content: out,
        });
      }
    } else {
      finalText = m.content || "";
      break;
    }
  }
  return finalText;
}

/*************** 4. Orquestração *********************************************/
const MAX_ITER = 10;
async function runPlan(plan) {
  // prepara workspace fora de os-ai
  await enterResultados();

  let feedback = "";
  for (let i = 1; i <= MAX_ITER; i++) {
    console.log(`\n===== ITERAÇÃO ${i} =====`);

    /* -------- BUILDER --------------------------------------------------- */
    const builderSys = `Você é o BUILDER. Seu objetivo é PRODUZIR código dentro da pasta ../resultados que atenda ao plano.\n\
- Use mkdir, write, touch, rm, exec, etc., lembrando que já estamos posicionados em ../resultados.\n\
- Crie package.json com "start":"node index.js" e rode "exec npm init -y" se ainda não existir.
- Instale dependências com "exec npm install express body-parser --silent --yes".
- Execute \"exec npm start\" ou \"exec node index.js\" para checar antes de passar ao TESTER.\n\
- Insira console.log em pontos estratégicos para depuração.\n\
`;

    const builderUser = feedback
      ? `Erro a ser corrigido:\n${feedback}`
      : `Plano principal:\n${plan}`;
    const builderReply = await chat("builder", builderSys, builderUser);
    console.log("Builder →\n" + builderReply.trim());

    /* -------- TESTER ---------------------------------------------------- */
    const testerSys = `
    Você é o TESTER. Sua missão é GARANTIR que o projeto implementa fielmente o
    plano fornecido e que o servidor Node.js realmente funciona.
    
    ⚙️  Procedimento obrigatório a cada iteração
    1. **Mapeamento de arquivos**
       • Use 'tree' para listar a estrutura da pasta atual (../resultados).
       • Leia os arquivos‑chave com 'read': package.json, index.js, rotas, models, etc.
       • Verifique se o código usa Express e exporta rotas CRUD para TODAS as
         entidades solicitadas no plano (por ex.: User, Post, Comment).
    
    2. **Verificação de dependências e scripts**
       • Se existir package.json mas faltar "start": "node index.js", responda FAIL
         explicando.
       • Caso não haja node_modules ou package-lock.json, rode
         'exec npm install --silent --yes'.
       • Se não houver package.json, responda FAIL.
    
    3. **Execução do servidor**
       • Tente 'exec npm start'.  
         Se falhar porque não há script, tente 'exec node index.js'.
       • Se ocorrer erro de porta ocupada, tente usar outra porta ou mate o processo
         anterior ('exec taskkill /IM node.exe /F' no Windows).
    
    4. **Teste funcional**
       • Aguarde ~1 segundo após iniciar o servidor.
       • Faça uma requisição de teste:
           'exec curl http://localhost:3000/api/users --max-time 5'
         (substitua o endpoint conforme entidades exigidas).
       • O retorno esperado deve ser **HTTP 200** ou JSON válido.  
         Se vier 404, 500 ou timeout, responda FAIL.
    
    5. **Encerramento do servidor**
       • Após o curl de teste, encerre o Node para liberar a porta:
           'exec taskkill /IM node.exe /F'   (Windows)
    
    6. **Critérios de aprovação**
       • Somente responda **SUCCESS** (em letras maiúsculas, sem mais nada)
         quando TODOS os pontos acima estiverem corretos e a rota de teste
         responder 200 com corpo adequado.
       • Caso contrário, responda **FAIL** seguido de uma quebra de linha e o
         detalhamento dos problemas encontrados (erros de console, rota ausente,
         dependência faltando, etc.).
    
    Exemplos de saída esperada:
      SUCCESS
    ou
      FAIL
      Route /api/posts retorna 404
    `;
    const testerReply = await chat("tester", testerSys, "Testar o código");
    console.log("Tester →\n" + testerReply.trim());

    if (testerReply.trim().startsWith("SUCCESS")) {
      console.log("\n✅ Projeto finalizado sem erros!");
      return;
    }
    feedback = testerReply || "Falha desconhecida";
  }
  console.log("\n⚠️  Limite de iterações atingido.");
}

/* ***** 5. CLI ************************************************************* */
const planArg =
  "Crie um servidor Node.js com Express contendo três entidades: User (id, name, email, password, createdAt), Post (id, title, content, authorId, createdAt) e Comment (id, text, postId, userId, createdAt), todas com rotas CRUD (create, read, update, delete) implementadas. nao use database, utilize apenas uma [] para simplificar, porem faca com a estrutura de pastas da clean arq";
if (!planArg) {
  console.error('Uso: node ai-agent-loop.js "<plano em linguagem natural>"');
  process.exit(1);
}

runPlan(planArg).catch((e) => console.error("Erro fatal:", e));
