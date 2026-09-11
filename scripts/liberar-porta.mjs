import { execSync } from "node:child_process";

const porta = process.argv[2] || "3001";

function pidsNaPorta(portaAlvo) {
  let saida = "";

  try {
    saida = execSync("netstat -ano", { encoding: "utf8" });
  } catch {
    return [];
  }

  const pids = new Set();
  const marca = new RegExp(`:${portaAlvo}\\s`);

  for (const linha of saida.split(/\r?\n/)) {
    if (!linha.includes("LISTENING") || !marca.test(linha)) {
      continue;
    }

    const colunas = linha.trim().split(/\s+/);
    const pid = colunas[colunas.length - 1];

    if (pid && pid !== "0" && /^\d+$/.test(pid)) {
      pids.add(pid);
    }
  }

  return [...pids];
}

const pids = pidsNaPorta(porta);

for (const pid of pids) {
  try {
    execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore" });
    console.log(`Porta ${porta} liberada (PID ${pid}).`);
  } catch {
    // Processo já encerrado entre o netstat e o taskkill.
  }
}

if (pids.length === 0) {
  console.log(`Porta ${porta} já estava livre.`);
}
