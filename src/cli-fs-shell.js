// cli-fs-shell.js
// Versão 4 — comandos avançados de arquivos + navegação + fetch + chrome (Windows friendly)
// -----------------------------------------------------------------------------
// API de uso:
// import { runCommand } from "./cli-fs-shell.js";
// const out = await runCommand("ls");
// -----------------------------------------------------------------------------
// Estado mantido: diretório atual (cwd) entre chamadas.
// -----------------------------------------------------------------------------

import fs from "node:fs/promises";
import { exec as execCallback } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const exec = promisify(execCallback);
let cwd = process.cwd();

const HELP = `Comandos disponíveis:
  help                           - mostra esta ajuda
  pwd                            - mostra diretório atual
  cd <path>                      - altera diretório atual
  ls [path]                      - lista arquivos/dirs
  tree [path]                    - mostra hierarquia recursiva
  mkdir <path>                   - cria diretório (relativo ao cwd)
  touch <file>                   - cria arquivo vazio
  write <file> <texto ...>       - acrescenta texto no arquivo
  read  <file>                   - exibe conteúdo do arquivo
  rm [-rf] <path>                - remove arquivo/diretório
  cp [-r] <src> <dest>           - copia arquivo/diretório
  mv <src> <dest>                - move/renomeia arquivo/diretório
  fetch <url> [dest]             - faz HTTP GET (salva em arquivo se dest)
  exec  <cmd>                    - executa comando do sistema
  chrome [url]                   - abre o Google Chrome (na URL, se informada)
  <qualquer cmd>                 - executa diretamente (node, dir, etc)`;

function resolve(p) {
  return path.isAbsolute(p) ? p : path.join(cwd, p);
}

function buildChromeCommand(url = "") {
  const quotedUrl = url ? `"${url}"` : "";
  return `start "" chrome ${quotedUrl}`.trim(); // Windows
}

// Utilitário recursivo para o comando tree
async function buildTree(dir, prefix = "") {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const lines = [];
  const lastIdx = entries.length - 1;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const connector = i === lastIdx ? "└── " : "├── ";
    lines.push(prefix + connector + entry.name);
    if (entry.isDirectory()) {
      const subPrefix = prefix + (i === lastIdx ? "    " : "│   ");
      lines.push(...(await buildTree(path.join(dir, entry.name), subPrefix)));
    }
  }
  return lines;
}

export async function runCommand(line) {
  if (!line.trim()) return "";

  const [cmd, ...args] = line.trim().split(/\s+/);

  switch (cmd) {
    // AJUDA --------------------------------------------------
    case "help":
      return HELP;

    // DIRETÓRIO ATUAL ---------------------------------------
    case "pwd":
      return cwd;

    // NAVEGAÇÃO ---------------------------------------------
    case "cd": {
      if (!args[0]) throw new Error("Uso: cd <path>");
      const dest = resolve(args[0]);
      await fs.access(dest);
      cwd = dest;
      return `Diretório atual: ${cwd}`;
    }

    // LISTAGEM ----------------------------------------------
    case "ls": {
      const dir = args[0] ? resolve(args[0]) : cwd;
      const entries = await fs.readdir(dir, { withFileTypes: true });
      return entries
        .map((e) => (e.isDirectory() ? "[D] " : "    ") + e.name)
        .join("\n");
    }

    case "tree": {
      const dir = args[0] ? resolve(args[0]) : cwd;
      const lines = await buildTree(dir);
      return [path.basename(dir), ...lines].join("\n");
    }

    // CRIAÇÃO ------------------------------------------------
    case "mkdir": {
      if (!args[0]) throw new Error("Uso: mkdir <path>");
      await fs.mkdir(resolve(args[0]), { recursive: true });
      return `Diretório '${args[0]}' criado.`;
    }

    case "touch": {
      if (!args[0]) throw new Error("Uso: touch <file>");
      await fs.writeFile(resolve(args[0]), "", { flag: "a" });
      return `Arquivo '${args[0]}' criado.`;
    }

    // ESCRITA & LEITURA -------------------------------------
    case "write": {
      const [file, ...textParts] = args;
      if (!file || textParts.length === 0)
        throw new Error("Uso: write <file> <texto ...>");
      await fs.appendFile(resolve(file), textParts.join(" ") + "\n");
      return `Texto gravado em '${file}'.`;
    }

    case "read": {
      if (!args[0]) throw new Error("Uso: read <file>");
      const data = await fs.readFile(resolve(args[0]), "utf8");
      return data;
    }

    // REMOVER -----------------------------------------------
    case "rm": {
      if (args.length === 0) throw new Error("Uso: rm [-rf] <path>");
      const flags = args.filter((a) => a.startsWith("-"));
      const paths = args.filter((a) => !a.startsWith("-"));
      const recursive = flags.some((f) => f.includes("r"));
      const force = flags.some((f) => f.includes("f"));
      await fs.rm(resolve(paths[0]), { recursive, force });
      return `Removido '${paths[0]}'${recursive ? " recursivamente" : ""}.`;
    }

    // COPIAR -------------------------------------------------
    case "cp": {
      if (args.length < 2) throw new Error("Uso: cp [-r] <src> <dest>");
      const recursive = args.includes("-r");
      const filtered = args.filter((a) => a !== "-r");
      const [src, dest] = filtered;
      await fs.cp(resolve(src), resolve(dest), { recursive });
      return `Copiado '${src}' → '${dest}'.`;
    }

    // MOVER --------------------------------------------------
    case "mv": {
      if (args.length < 2) throw new Error("Uso: mv <src> <dest>");
      const [src, dest] = args;
      await fs.rename(resolve(src), resolve(dest));
      return `Movido '${src}' → '${dest}'.`;
    }

    // FETCH --------------------------------------------------
    case "fetch": {
      if (!args[0]) throw new Error("Uso: fetch <url> [dest]");
      const [url, dest] = args;
      const res = await fetch(url);
      const buf = Buffer.from(await res.arrayBuffer());
      if (dest) {
        await fs.writeFile(resolve(dest), buf);
        return `Salvo em '${dest}' (${buf.length} bytes).`;
      }
      // devolve no máx 1 kB para evitar flooding
      return buf.toString("utf8").slice(0, 1024);
    }

    // EXEC ---------------------------------------------------
    case "exec": {
      if (args.length === 0) throw new Error("Uso: exec <cmd>");
      const { stdout, stderr } = await exec(args.join(" "), {
        cwd,
        shell: true,
        timeout: 30_000, // 30 s
        maxBuffer: 10 * 1024 * 1024, // 10 MB
      });
      return (stdout || "") + (stderr || "");
    }

    // CHROME -------------------------------------------------
    case "chrome": {
      const url = args.join(" ");
      const chromeCmd = buildChromeCommand(url);
      try {
        await exec(chromeCmd, { cwd, shell: true });
        return `Chrome aberto${url ? ` em ${url}` : ""}.`;
      } catch (err) {
        return `Erro ao abrir o Chrome: ${err.message}`;
      }
    }

    // FALLBACK ----------------------------------------------
    default: {
      const { stdout, stderr } = await exec([cmd, ...args].join(" "), {
        cwd,
        shell: true,
      });
      return (stdout || "") + (stderr || "");
    }
  }
}
