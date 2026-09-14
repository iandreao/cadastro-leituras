const AZUL_BOTAO = "#2563eb";
const TEXTO = "#334155";
const FUNDO = "#f1f5f9";

export function montarHtmlEmailRecuperacao(resetUrl: string) {
  const url = resetUrl.replace(/"/g, "&quot;");

  return `
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Recuperação de senha - Portal do Condomínio</title>
  </head>
  <body style="margin:0;padding:0;background-color:${FUNDO};font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${FUNDO};padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,0.06);">
            <tr>
              <td style="background-color:#0b3b4a;padding:20px 28px;">
                <p style="margin:0;color:#99f6e4;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;">
                  Portal do Condomínio
                </p>
                <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;line-height:1.3;font-weight:600;">
                  Recuperação de senha - Portal do Condomínio
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 16px;color:${TEXTO};font-size:15px;line-height:1.6;">
                  Olá! Recebemos uma solicitação para redefinir a senha da sua conta. Se você não fez este pedido, pode ignorar este e-mail com segurança. Caso contrário, clique no botão abaixo para escolher sua nova senha:
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="padding:12px 0 20px;">
                      <a href="${url}" style="display:inline-block;background-color:${AZUL_BOTAO};color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:12px 28px;border-radius:8px;">
                        Redefinir Minha Senha
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;text-align:center;">
                  Este link é válido por 1 hora.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}

export function montarTextoEmailRecuperacao(resetUrl: string) {
  return [
    "Recuperação de senha - Portal do Condomínio",
    "",
    "Olá! Recebemos uma solicitação para redefinir a senha da sua conta. Se você não fez este pedido, pode ignorar este e-mail com segurança. Caso contrário, abra o link abaixo para escolher sua nova senha:",
    resetUrl,
    "",
    "Este link é válido por 1 hora.",
  ].join("\n");
}
