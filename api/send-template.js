module.exports = async function(req, res){

  try {

    /* ===== INPUT ===== */
    const { telefone, template } = req.body

    if(!telefone || !template){
      return res.status(400).json({
        error: "telefone ou template não enviado"
      })
    }

    /* ===== CONFIG ===== */

    const PHONE_ID = process.env.PHONE_NUMBER_ID || "1047101948485043"
    const TOKEN = process.env.WHATSAPP_TOKEN

    if(!TOKEN){
      return res.status(500).json({
        error: "WHATSAPP_TOKEN não configurado"
      })
    }

    console.log("📞 TELEFONE:", telefone)
    console.log("📨 TEMPLATE:", template)
    console.log("📌 PHONE_ID:", PHONE_ID)

    /* ===== URL META ===== */

    const url = `https://graph.facebook.com/v19.0/${PHONE_ID}/messages`

    /* ===== IDIOMAS ===== */

    const TEMPLATE_IDIOMAS = {
      confirmao_de_reserva: "en_US",
      reserva_especial: "en_US",
      hello_world: "en_US"
    }

    const idioma = TEMPLATE_IDIOMAS[template]

    if(!idioma){
      return res.status(400).json({
        error: "template não permitido ou sem idioma"
      })
    }

    /* ===== PAYLOAD ===== */

    const payload = {
      messaging_product: "whatsapp",
      to: telefone,
      type: "template",
      template: {
        name: template,
        language: { code: idioma },
        components: [
          {
            type: "body",
            parameters: [
              {
                type: "text",
                text: "Cliente"
              }
            ]
          }
        ]
      }
    }

    console.log("📦 PAYLOAD:", JSON.stringify(payload, null, 2))

    /* ===== ENVIO ===== */

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    })

    const data = await resp.json()

    console.log("📩 RESPONSE META:", data)

    /* ===== ERRO META ===== */

    if(data.error){
      return res.status(500).json({
        error: data.error
      })
    }

    /* ===== SUCESSO ===== */

    return res.json({
      ok: true,
      enviado: true,
      meta: data
    })

  } catch (err){

    console.error("🔥 ERRO GERAL:", err)

    return res.status(500).json({
      error: err.message
    })
  }

}
