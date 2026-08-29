# Cadastro de Leituras – Água e Gás

Sistema de cadastro de condomínios, unidades e leituras, com Next.js, TypeScript, Tailwind CSS e Prisma.

## Como executar

```bash
cd cadastro-leituras
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). A primeira tela é login/cadastro.

## Regras já implementadas

- Condomínio único por CNPJ, com consulta à Receita Federal ao completar 14 dígitos
- Unidade única por condomínio
- Exclusão bloqueada quando houver leitura vinculada
- Listas em ordem inversa de inclusão/alteração
