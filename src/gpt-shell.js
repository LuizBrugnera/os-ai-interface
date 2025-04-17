// gpt-shell.js v2 — compatível com a API OpenAI 4.x (tools + tool_calls)
// --------------------------------------------------------------------
// Chat‑GPT CLI que entende linguagem natural e usa runCommand() quando
// necessário para criar arquivos, ler, escrever e executar comandos.
// --------------------------------------------------------------------
// Pré‑requisitos:
//   npm install openai dotenv
//   export OPENAI_API_KEY="sua‑chave"
//   (cli-fs-shell.js precisa estar no mesmo diretório)
// --------------------------------------------------------------------

import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { OpenAI } from "openai";
import { runCommand } from "./cli-fs-shell.js";
import "dotenv/config";
import { tools } from "./tools.js";
// --------------------------------------------------------------------
// Config OpenAI
// --------------------------------------------------------------------
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Definição da função exposta ao modelo (novo formato: tools[] → { type:'function', function:{ ... } })

async function chatLoop() {
  const rl = readline.createInterface({ input, output, prompt: "> " });

  const messages = [
    {
      role: "system",
      content:
        "Você é um assistente de linha de comando. Quando necessário, use a função runCommand para criar pastas, arquivos, escrever, ler ou executar comandos. Relate para o usuário de forma breve o que está fazendo.",
    },
  ];

  rl.prompt();
  for await (const userLine of rl) {
    if (userLine.trim().toLowerCase() === "exit") break;

    messages.push({ role: "user", content: userLine });

    let keepLoop = true;
    while (keepLoop) {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        tools,
        tool_choice: "auto",
      });

      const message = response.choices[0].message;

      if (message.tool_calls && message.tool_calls.length > 0) {
        messages.push(message);

        for (const call of message.tool_calls) {
          if (call.type !== "function") continue;

          const args = JSON.parse(call.function.arguments || "{}");

          const parts = [call.function.name];
          for (const [key, val] of Object.entries(args)) {
            if (typeof val === "boolean") {
              if (val) parts.push(`--${key}`);
            } else {
              parts.push(String(val));
            }
          }
          const line = parts.join(" ");

          let outputText;
          try {
            outputText = await runCommand(line);
          } catch (err) {
            outputText = `Erro: ${err.message}`;
          }

          messages.push({
            role: "tool",
            tool_call_id: call.id,
            name: call.function.name,
            content: outputText ?? "",
          });
        }
      } else {
        console.log(message.content.trim());
        messages.push(message);
        keepLoop = false;
      }
    }

    rl.prompt();
  }

  rl.close();
}

chatLoop().catch((err) => console.error("Erro no chat:", err));
