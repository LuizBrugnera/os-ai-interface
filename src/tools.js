export const tools = [
  {
    type: "function",
    function: {
      name: "help",
      description: "Mostra a lista de comandos disponíveis no mini‑shell.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "pwd",
      description: "Mostra o diretório de trabalho atual.",
      parameters: { type: "object", properties: {} },
    },
  },
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
  {
    type: "function",
    function: {
      name: "ls",
      description: "Lista arquivos e diretórios.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Diretório (opcional)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "tree",
      description: "Mostra a hierarquia de arquivos.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Diretório (opcional)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mkdir",
      description: "Cria diretório.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Caminho." } },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "touch",
      description: "Cria arquivo vazio.",
      parameters: {
        type: "object",
        properties: { file: { type: "string", description: "Arquivo." } },
        required: ["file"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write",
      description: "Acrescenta texto a arquivo.",
      parameters: {
        type: "object",
        properties: { file: { type: "string" }, text: { type: "string" } },
        required: ["file", "text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read",
      description: "Lê arquivo.",
      parameters: {
        type: "object",
        properties: { file: { type: "string" } },
        required: ["file"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rm",
      description: "Remove arquivo/diretório.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          recursive: { type: "boolean" },
          force: { type: "boolean" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cp",
      description: "Copia arquivo/diretório.",
      parameters: {
        type: "object",
        properties: {
          src: { type: "string" },
          dest: { type: "string" },
          recursive: { type: "boolean" },
        },
        required: ["src", "dest"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mv",
      description: "Move/renomeia arquivo.",
      parameters: {
        type: "object",
        properties: { src: { type: "string" }, dest: { type: "string" } },
        required: ["src", "dest"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch",
      description: "HTTP GET; opcional salva em arquivo.",
      parameters: {
        type: "object",
        properties: { url: { type: "string" }, dest: { type: "string" } },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "exec",
      description: "Executa comando do sistema.",
      parameters: {
        type: "object",
        properties: { command: { type: "string" } },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "chrome",
      description: "Abre Chrome (Windows).",
      parameters: { type: "object", properties: { url: { type: "string" } } },
    },
  },
];
