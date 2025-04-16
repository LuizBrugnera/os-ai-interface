// cli-fs-shell.js
// Versão 2 — agora com suporte a `cd`, `pwd` e execução direta de QUALQUER comando
// ----------------------------------------------------
// API: import { runCommand } from './cli-fs-shell.js';
//       const out = await runCommand('node -v');
//
// Estado mantido: diretório atual (cwd) entre chamadas.
// ----------------------------------------------------

import fs from 'node:fs/promises';
import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const exec = promisify(execCallback);
let cwd = process.cwd();

const HELP = `Comandos disponíveis:
  help                         - mostra esta ajuda
  pwd                          - mostra diretório atual
  cd <path>                    - altera diretório atual
  mkdir <path>                 - cria diretório (relativo ao cwd)
  touch <file>                 - cria arquivo vazio
  write <file> <texto ...>     - acrescenta texto no arquivo
  read  <file>                 - exibe conteúdo do arquivo
  exec  <cmd>                  - executa comando do sistema
  <qualquer cmd>               - executa diretamente (node, ls, cd .., etc)`;

function resolve(p) {
  return path.isAbsolute(p) ? p : path.join(cwd, p);
}

export async function runCommand(line) {
  if (!line.trim()) return '';

  const [cmd, ...args] = line.trim().split(/\s+/);

  switch (cmd) {
    case 'help':
      return HELP;

    case 'pwd':
      return cwd;

    case 'cd': {
      if (!args[0]) throw new Error('Uso: cd <path>');
      const dest = resolve(args[0]);
      await fs.access(dest); // garante que existe
      cwd = dest;
      return `Diretório atual: ${cwd}`;
    }

    case 'mkdir': {
      if (!args[0]) throw new Error('Uso: mkdir <path>');
      await fs.mkdir(resolve(args[0]), { recursive: true });
      return `Diretório '${args[0]}' criado.`;
    }

    case 'touch': {
      if (!args[0]) throw new Error('Uso: touch <file>');
      await fs.writeFile(resolve(args[0]), '', { flag: 'a' });
      return `Arquivo '${args[0]}' criado.`;
    }

    case 'write': {
      const [file, ...textParts] = args;
      if (!file || textParts.length === 0) throw new Error('Uso: write <file> <texto ...>');
      await fs.appendFile(resolve(file), textParts.join(' ') + '\n');
      return `Texto gravado em '${file}'.`;
    }

    case 'read': {
      if (!args[0]) throw new Error('Uso: read <file>');
      const data = await fs.readFile(resolve(args[0]), 'utf8');
      return data;
    }

    case 'exec': {
      if (args.length === 0) throw new Error('Uso: exec <cmd>');
      const { stdout, stderr } = await exec(args.join(' '), { cwd });
      return (stdout || '') + (stderr || '');
    }

    default: {
      // fallback: executa qualquer comando do SO respeitando cwd
      const { stdout, stderr } = await exec([cmd, ...args].join(' '), { cwd });
      return (stdout || '') + (stderr || '');
    }
  }
}
