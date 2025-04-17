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

// --------------------------------------------------------------------
// Config OpenAI
// --------------------------------------------------------------------
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Definição da função exposta ao modelo (novo formato: tools[] → { type:'function', function:{ ... } })
const tools = [
  /* AJUDA ------------------------------------------------------------------ */
  {
    type: "function",
    function: {
      name: "help",
      description: "Mostra a lista de comandos disponíveis no mini‑shell.",
      parameters: { type: "object", properties: {} },
    },
  },

  /* DIRETÓRIO ATUAL -------------------------------------------------------- */
  {
    type: "function",
    function: {
      name: "pwd",
      description: "Mostra o diretório de trabalho atual.",
      parameters: { type: "object", properties: {} },
    },
  },

  /* NAVEGAÇÃO -------------------------------------------------------------- */
  {
    type: "function",
    function: {
      name: "cd",
      description: "Altera o diretório de trabalho.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Caminho relativo ou absoluto.",
          },
        },
        required: ["path"],
      },
    },
  },

  /* LISTAGEM --------------------------------------------------------------- */
  {
    type: "function",
    function: {
      name: "ls",
      description: "Lista arquivos e diretórios. Se omitido, usa o cwd.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Diretório a listar (opcional).",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "tree",
      description:
        "Mostra a hierarquia de arquivos recursivamente (tipo tree).",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Diretório raiz (opcional)." },
        },
      },
    },
  },

  /* CRIAÇÃO / EDIÇÃO ------------------------------------------------------- */
  {
    type: "function",
    function: {
      name: "mkdir",
      description: "Cria um diretório (relativo ao cwd).",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Nome ou caminho do diretório.",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "touch",
      description: "Cria um arquivo vazio.",
      parameters: {
        type: "object",
        properties: {
          file: { type: "string", description: "Nome ou caminho do arquivo." },
        },
        required: ["file"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write",
      description: "Acrescenta texto a um arquivo (cria se não existir).",
      parameters: {
        type: "object",
        properties: {
          file: { type: "string", description: "Arquivo de destino." },
          text: { type: "string", description: "Texto a ser escrito." },
        },
        required: ["file", "text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read",
      description: "Exibe o conteúdo de um arquivo.",
      parameters: {
        type: "object",
        properties: {
          file: { type: "string", description: "Arquivo a ser lido." },
        },
        required: ["file"],
      },
    },
  },

  /* MANIPULAÇÃO DE ARQUIVOS ------------------------------------------------ */
  {
    type: "function",
    function: {
      name: "rm",
      description: "Remove arquivo ou diretório.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Arquivo ou diretório a remover.",
          },
          recursive: {
            type: "boolean",
            description: "Se true, remove recursivamente.",
          },
          force: {
            type: "boolean",
            description: "Ignora erros de arquivo inexistente.",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cp",
      description: "Copia arquivo ou diretório.",
      parameters: {
        type: "object",
        properties: {
          src: { type: "string", description: "Origem." },
          dest: { type: "string", description: "Destino." },
          recursive: { type: "boolean", description: "Copia recursivamente." },
        },
        required: ["src", "dest"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mv",
      description: "Move ou renomeia arquivo/diretório.",
      parameters: {
        type: "object",
        properties: {
          src: { type: "string", description: "Origem." },
          dest: { type: "string", description: "Destino." },
        },
        required: ["src", "dest"],
      },
    },
  },

  /* REDE ------------------------------------------------------------------- */
  {
    type: "function",
    function: {
      name: "fetch",
      description:
        "Faz HTTP GET; se `dest` for fornecido, salva o conteúdo em arquivo.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL de destino." },
          dest: {
            type: "string",
            description: "Arquivo onde salvar (opcional).",
          },
        },
        required: ["url"],
      },
    },
  },

  /* EXECUÇÃO DE COMANDO ---------------------------------------------------- */
  {
    type: "function",
    function: {
      name: "exec",
      description:
        "Executa um comando do sistema no cwd atual, lembre que ao usar o exec voce esta em um ambiente windows.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "Linha de comando completa.",
          },
        },
        required: ["command"],
      },
    },
  },

  /* NAVEGADOR -------------------------------------------------------------- */
  {
    type: "function",
    function: {
      name: "chrome",
      description:
        "Abre o Google Chrome (ou navegador padrão) e, se fornecida, navega para a URL.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL a abrir (opcional)." },
        },
      },
    },
  },
];

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
