module.exports = async function(req, res){

  try {

    const { telefone, template, parametros = {} } = req.body

    if(!telefone || !template){
      return res.status(400).json({
        error: "telefone ou template não enviado"
      })
    }

    const PHONE_ID = process.env.PHONE_NUMBER_ID
    const TOKEN = process.env.WHATSAPP_TOKEN

    if(!TOKEN || !PHONE_ID){
      return res.status(500).json({
        error: "WHATSAPP não configurado"
      })
    }

    const url = `https://graph.facebook.com/v19.0/${PHONE_ID}/messages`

    console.log("📤 TEMPLATE:", template)
    console.log("📞 TELEFONE:", telefone)
    console.log("📊 PARAMETROS:", parametros)

    /* =====================================================
       CONFIGURAÇÃO CENTRAL DOS TEMPLATES
    ===================================================== */

    const templates = {

      /* ===== CONFIRMAÇÃO DE RESERVA ===== */
      confirmao_de_reserva: {
        language: "pt_BR",
        build: () => ({
          name: "confirmao_de_reserva",
          language: { code: "pt_BR" },
          components: [
            {
              type: "body",
              parameters: [
                { type:"text", text: parametros.nome || "Cliente" },
                { type:"text", text: parametros.data || "--/--" },
                { type:"text", text: parametros.hora || "--:--" },
                { type:"text", text: String(parametros.pessoas || "1") }
              ]
            }
          ]
        })
      },

      /* ===== RESERVA ESPECIAL COM VIDEO ===== */
      reserva_especial: {
        language: "pt_BR",
        build: () => ({
          name: "reserva_especial",
          language: { code: "pt_BR" },
          components: [
            {
              type: "header",
              parameters: [
                {
                  type: "video",
                  video: {
                    link: parametros.video || "https://SEU_VIDEO_AQUI.mp4"
                  }
                }
              ]
            }
          ]
        })
      },

      /* ===== HELLO WORLD ===== */
      hello_world: {
        language: "en_US",
        build: () => ({
          name: "hello_world",
          language: { code: "en_US" }
        })
      }

    }

    /* =====================================================
       VALIDAR TEMPLATE
    ===================================================== */

    if(!templates[template]){
      return res.status(400).json({
        error: "Template não existe na API"
      })
    }

    const templateData = templates[template].build()

    /* =====================================================
       PAYLOAD
    ===================================================== */

    const payload = {
      messaging_product: "whatsapp",
      to: telefone,
      type: "template",
      template: templateData
    }

    console.log("📦 PAYLOAD FINAL:", JSON.stringify(payload, null, 2))

    /* =====================================================
       ENVIO TEMPLATE
    ===================================================== */

    const resp = await fetch(url,{
      method:"POST",
      headers:{
        Authorization:`Bearer ${TOKEN}`,
        "Content-Type":"application/json"
      },
      body: JSON.stringify(payload)
    })

    const data = await resp.json()

    console.log("📩 META RESPONSE:", data)

    /* =====================================================
       FALLBACK AUTOMÁTICO (SE TEMPLATE FALHAR)
    ===================================================== */

    if(data.error){

      console.log("⚠️ TEMPLATE FALHOU, ENVIANDO TEXTO...")

      const fallbackMsg = gerarFallback(template, parametros)

      await fetch(url,{
        method:"POST",
        headers:{
          Authorization:`Bearer ${TOKEN}`,
          "Content-Type":"application/json"
        },
        body: JSON.stringify({
          messaging_product:"whatsapp",
          to:telefone,
          type:"text",
          text:{ body:fallbackMsg }
        })
      })

      return res.json({
        ok:true,
        fallback:true,
        erro_template:data.error
      })
    }

    return res.json({
      ok:true,
      enviado:true,
      data
    })

  } catch (err){

    console.error("🔥 ERRO GERAL:", err)

    return res.status(500).json({
      error: err.message
    })
  }
}

/* =====================================================
   FALLBACK AUTOMÁTICO
===================================================== */

function gerarFallback(template, p){

  switch(template){

    case "confirmao_de_reserva":
      return `✅ Reserva confirmada!

Nome: ${p.nome || "Cliente"}
Data: ${p.data || "--"}
Hora: ${p.hora || "--"}
Pessoas: ${p.pessoas || "1"}`

    case "reserva_especial":
      return `✨ Reserva especial disponível!

Clique no vídeo:
${p.video || ""}`

    case "hello_world":
      return "Olá! Bem-vindo ao Mercatto Delícia 😊"

    default:
      return "Mensagem enviada."
  }
}
