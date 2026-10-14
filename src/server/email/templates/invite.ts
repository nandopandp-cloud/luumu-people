
/**
 * E-mail de convite de acesso. HTML de e-mail: tabelas, estilos inline, 600 px
 * de largura e imagens em PNG hospedadas em /email (Gmail e Outlook não exibem
 * SVG). Imagens geradas por scripts/build-email-assets.mts.
 */

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export type InviteEmail = {
  name: string;
  inviterName: string;
  organizationName: string;
  url: string;
  expiresAt: Date;
  /** Origem pública da aplicação (APP_URL), para as imagens. */
  assetBase: string;
};

/** Versão das imagens em public/email (suba ao regerar com scripts/build-email-assets.mts). */
const ASSET_VERSION = "3";

const FONT = "'Inter','Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif";
const INK = "#16123A";
const MUTED = "#5B5876";
const PURPLE = "#6D28D9";

const FEATURES = [
  { icon: "icon-comunicados.png", title: "Receber<br>comunicados", text: "Fique por dentro das novidades da empresa." },
  { icon: "icon-colegas.png", title: "Se conectar<br>com colegas", text: "Conheça pessoas, interaja e fortaleça o trabalho em equipe." },
  { icon: "icon-pesquisas.png", title: "Participar<br>de pesquisas", text: "Compartilhe sua opinião e ajude a construir um ambiente melhor." },
  { icon: "icon-desenvolvimento.png", title: "Acompanhar seu<br>desenvolvimento", text: "Visualize suas metas, competências e evolução." },
];

export function inviteEmail(input: InviteEmail) {
  const first = input.name.trim().split(/\s+/)[0] ?? "";
  const until = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" }).format(input.expiresAt);
  // `?v=`: muda quando as imagens mudam, para o Gmail não usar a cópia antiga em cache.
  const img = (file: string) => `${input.assetBase.replace(/\/$/, "")}/email/${file}?v=${ASSET_VERSION}`;
  const e = {
    first: escapeHtml(first),
    inviter: escapeHtml(input.inviterName),
    org: escapeHtml(input.organizationName),
    url: escapeHtml(input.url),
  };

  const subject = `${input.inviterName} convidou você para a Luumu People`;

  const text = [
    `Olá, ${first}!`,
    "",
    `${input.inviterName} convidou você para acessar a Luumu People da ${input.organizationName}, nossa plataforma de comunicação, integração e desenvolvimento das pessoas.`,
    "",
    "Na Luumu People você poderá: receber comunicados, se conectar com colegas, participar de pesquisas e acompanhar seu desenvolvimento.",
    "",
    "Vamos ativar sua conta? Para começar, basta criar sua senha:",
    input.url,
    "",
    `O convite é pessoal e válido até ${until}. Se o prazo expirar, solicite um novo convite ao seu gestor ou ao time de Gente & Gestão.`,
    "",
    "Estamos felizes em ter você com a gente. Que essa seja uma jornada de muitas conexões e conquistas!",
    "",
    "Com carinho,",
    "Time Luumu People",
    "",
    "Este é um e-mail automático. Em caso de dúvidas, entre em contato com o time de Gente & Gestão.",
  ].join("\n");

  const features = FEATURES.map(
    (f) => `
      <td class="feature" width="25%" valign="top" style="padding:0 8px 0 0">
        <img src="${img(f.icon)}" width="56" height="56" alt="" style="display:block;border:0">
        <p style="margin:14px 0 6px;font:700 15px/20px ${FONT};color:${INK}">${f.title}</p>
        <p style="margin:0;font:400 13px/19px ${FONT};color:${MUTED}">${f.text}</p>
      </td>`,
  ).join("");

  const html = `<!doctype html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(subject)}</title>
<style>
  body{margin:0;padding:0;background:#F4F1FB}
  a{color:${PURPLE}}
  @media (max-width:620px){
    .container{width:100%!important}
    .px{padding-left:22px!important;padding-right:22px!important}
    .stack{display:block!important;width:100%!important;box-sizing:border-box!important}
    .hero-art{max-width:100%!important;margin:0 auto;border-radius:0 0 24px 24px}
    .hero-copy-cell{padding-top:0!important}
    .hero-copy-cell table{border-radius:24px!important}
    .hero-copy{height:auto!important;padding:28px 22px!important}
    .hero-title{font-size:30px!important;line-height:34px!important}
    .feature{display:inline-block!important;width:48%!important;padding:0 0 22px!important;vertical-align:top}
    .tagline{display:none!important}
    .cta{padding:16px 32px!important;white-space:nowrap}
  }
</style>
</head>
<body style="margin:0;padding:0;background:#F4F1FB">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${e.inviter} convidou você para a Luumu People. Crie sua senha para ativar a conta.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1FB">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#FFFFFF;border-radius:28px">

  <!-- Marca -->
  <tr><td class="px" style="padding:28px 32px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td valign="top"><img src="${img("logo.png")}" width="188" alt="Luumu People" style="display:block;border:0;width:188px;height:auto"></td>
      <td class="tagline" align="right" valign="top" style="font:400 13px/19px ${FONT};color:${MUTED}">Pessoas que se conectam,<br>crescem e constroem juntas.</td>
    </tr></table>
  </td></tr>

  <!-- Destaque: cartão lilás à esquerda; a ilustração "sai" acima do cartão (como na referência) -->
  <tr><td style="padding:0 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td class="stack hero-copy-cell" width="268" valign="bottom" style="padding:40px 0 0 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F3EFFE;border-radius:24px 0 0 24px">
            <tr><td class="hero-copy" height="224" valign="middle" style="height:224px;padding:18px 8px 18px 28px">
              <h1 class="hero-title" style="margin:0;font:800 30px/34px ${FONT};letter-spacing:-0.8px;color:${INK}">Você foi convidado para a <span style="color:${PURPLE}">Luumu People!</span></h1>
              <p style="margin:12px 0 0;font:400 14px/21px ${FONT};color:${MUTED}">Um espaço para se comunicar, se conectar e fazer parte de tudo o que acontece na nossa empresa.</p>
              <div style="width:44px;height:3px;background:${PURPLE};border-radius:3px;margin-top:16px;font-size:0;line-height:0">&nbsp;</div>
            </td></tr>
          </table>
        </td>
        <td class="stack" width="300" valign="bottom" style="padding:0;font-size:0;line-height:0">
          <img class="hero-art" src="${img("hero.png")}" width="300" height="300" alt="" style="display:block;border:0;width:100%;max-width:300px;height:auto">
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Saudação -->
  <tr><td class="px" style="padding:36px 40px 8px">
    <p style="margin:0;font:700 22px/30px ${FONT};color:${INK}">Olá, ${e.first}! 👋</p>
    <p style="margin:12px 0 0;font:400 16px/25px ${FONT};color:${MUTED}">${e.inviter} convidou você para acessar a Luumu People, nossa plataforma de comunicação, integração e desenvolvimento das pessoas.</p>
    <p style="margin:26px 0 18px;font:400 15px/22px ${FONT};color:${MUTED}">Na Luumu People você poderá:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${features}</tr></table>
  </td></tr>

  <!-- Ativação -->
  <tr><td class="px" style="padding:28px 24px 8px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F7F5FF;border:1px solid #ECE7FB;border-radius:20px">
      <tr><td style="padding:28px 28px 24px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="88" valign="top" class="stack" style="padding-bottom:12px"><img src="${img("icon-cadeado.png")}" width="72" height="72" alt="" style="display:block;border:0"></td>
          <td valign="middle" class="stack">
            <p style="margin:0;font:800 22px/28px ${FONT};color:${PURPLE}">Vamos ativar sua conta?</p>
            <p style="margin:6px 0 0;font:400 15px/22px ${FONT};color:${MUTED}">Para começar, basta criar sua senha. É rápido e simples.</p>
          </td>
        </tr></table>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:22px auto 0"><tr>
          <td align="center" bgcolor="${PURPLE}" style="border-radius:14px;background:${PURPLE}">
            <a class="cta" href="${e.url}" target="_blank" style="display:inline-block;padding:18px 96px;font:700 16px/20px ${FONT};color:#FFFFFF;text-decoration:none;border-radius:14px">Ativar minha conta &rarr;</a>
          </td>
        </tr></table>
        <p style="margin:18px 0 0;text-align:center;font:400 13px/20px ${FONT};color:${MUTED}">O convite é pessoal e válido até <strong style="color:${INK}">${until}</strong>. Se o prazo expirar,<br>solicite um novo convite ao seu gestor ou ao time de Gente &amp; Gestão.</p>
        <p style="margin:10px 0 0;text-align:center;font:400 12px/18px ${FONT};color:#8A87A3">Se o botão não funcionar, copie e cole este endereço no navegador:<br><a href="${e.url}" style="color:${PURPLE};word-break:break-all">${e.url}</a></p>
      </td></tr>
    </table>
  </td></tr>

  <!-- Despedida -->
  <tr><td class="px" style="padding:24px 40px 8px">
    <div style="border-top:1px solid #ECE7FB;font-size:0;line-height:0">&nbsp;</div>
    <p style="margin:20px 0 0;font:400 15px/23px ${FONT};color:${INK}">Estamos felizes em ter você com a gente. Que essa seja uma jornada de muitas conexões e conquistas!</p>
    <p style="margin:18px 0 0;font:400 15px/22px ${FONT};color:${INK}">Com carinho,</p>
    <p style="margin:2px 0 0;font:700 16px/24px ${FONT};color:${PURPLE}">Time Luumu People 💜</p>
  </td></tr>

  <!-- Rodapé -->
  <tr><td style="padding:24px 16px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F3EFFE;border-radius:20px">
      <tr>
        <td width="84" valign="middle" style="padding:16px 0 16px 28px"><img src="${img("mascot.png")}" width="44" alt="" style="display:block;border:0;width:44px;height:auto"></td>
        <td valign="middle" style="padding:16px 24px 16px 18px;border-left:1px solid #E2DAFB">
          <p style="margin:0;font:700 15px/20px ${FONT};color:${INK}">Luumu People</p>
          <p style="margin:2px 0 0;font:400 13px/19px ${FONT};color:${MUTED}">Comunicação. Conexão. Pessoas reais.</p>
        </td>
        <td class="tagline" width="130" valign="bottom" style="padding:0;font-size:0;line-height:0"><img src="${img("footer-leaves.png")}" width="130" height="76" alt="" style="display:block;border:0;border-radius:0 20px 20px 0"></td>
      </tr>
    </table>
  </td></tr>
  <tr><td class="px" align="center" style="padding:16px 32px 24px;font:400 12px/18px ${FONT};color:#8A87A3">Este é um e-mail automático. Em caso de dúvidas, entre em contato com o time de Gente &amp; Gestão.</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject, text, html };
}
