export default async function handler(req, res) {

  /* ===== CORS ===== */
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {

    const body = typeof req.body === "string"
      ? JSON.parse(req.body)
      : req.body;

    const { telefone, nomeTemplate, idioma, parametros } = body;

    /* ===== VALIDAÇÃO ===== */

    if (!telefone) {
      return res.status(400).json({ error: "Telefone obrigatório" });
    }

    if (!nomeTemplate) {
      return res.status(400).json({ error: "Nome do template obrigatório" });
    }

    if (!idioma) {
      return res.status(400).json({ error: "Idioma obrigatório" });
    }

    /* ===== FORMATAR TELEFONE ===== */

    const numero = telefone.replace(/\D/g, "");

    /* ===== MONTAR PARAMETROS ===== */

    const components = parametros?.length
      ? [
          {
            type: "body",
            parameters: parametros.map(p => ({
              type: "text",
              text: String(p)
            }))
          }
        ]
      : [];

    /* ===== REQUEST META ===== */

    const response = await fetch(
      `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: numero,
          type: "template",
          template: {
            name: nomeTemplate,
            language: { code: idioma },
            ...(components.length ? { components } : {})
          }
        })
      }
    );

    const data = await response.json();

    console.log("📤 Enviando template:");
    console.log({ numero, nomeTemplate, idioma, parametros });
    console.log("📩 Resposta Meta:", data);

    if (!response.ok) {
      return res.status(500).json({
        error: "Erro ao enviar template",
        details: data
      });
    }

    return res.status(200).json({
      success: true,
      meta: data
    });

  } catch (err) {
    console.error("❌ ERRO:", err);
    return res.status(500).json({
      error: "Erro interno",
      message: err.message
    });
  }
}
