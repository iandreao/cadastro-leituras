export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function toTitleCase(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/(^|[^A-Za-zÀ-ÿ0-9])([A-Za-zÀ-ÿ])/g, (_match, sep: string, letter: string) => {
      return `${sep}${letter.toLocaleUpperCase("pt-BR")}`;
    })
    .replace(/\bCep\b/g, "CEP")
    .replace(/\s-\s([A-Za-zÀ-ÿ]{2})\b/g, (_match, uf: string) => {
      return ` - ${uf.toLocaleUpperCase("pt-BR")}`;
    });
}

export function maskCnpj(value: string) {
  const digits = onlyDigits(value).slice(0, 14);

  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function maskCelular(value: string) {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

export function isValidCnpj(value: string) {
  const digits = onlyDigits(value);

  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) {
    return false;
  }

  const calc = (length: number) => {
    const weights =
      length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    const sum = digits
      .slice(0, length)
      .split("")
      .reduce((acc, digit, index) => acc + Number(digit) * weights[index], 0);

    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  return calc(12) === Number(digits[12]) && calc(13) === Number(digits[13]);
}

export function formatEnderecoReceita(data: {
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  uf?: string | null;
  cep?: string | null;
}) {
  const linha = [
    data.logradouro,
    data.numero,
    data.complemento,
    data.bairro,
  ]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");

  const cidade = [data.municipio, data.uf].filter(Boolean).join(" - ");
  const cep = data.cep ? `CEP ${data.cep}` : "";

  return [linha, cidade, cep].filter(Boolean).join(" • ");
}
