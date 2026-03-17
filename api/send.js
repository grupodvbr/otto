export default async function handler(req, res) {

  try {

    const { telefone, mensagem } = req.body

    if (!telefone || !mensagem) {
      return res.status(400).json({ error: "Faltando dados" })
    }

    const PHONE_ID = process.env.PHONE_ID
    const TOKEN = process.env.WHATSAPP_TOKEN

    if (!PHONE_ID) {
      return res.status(500).json({ error: "PHONE_ID não definido" })
    }

    if (!TOKEN) {
      return res.status(500).json({ error: "TOKEN não definido" })
    }

    const url = `https://graph.facebook.com/v19.0/${PHONE_ID}/messages`

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: telefone,
        type: "text",
        text: { body: mensagem }
      })
    })

    const data = await resp.json()

    console.log("ENVIO MANUAL:", data)

    if (data.error) {
      return res.status(500).json(data)
    }

    return res.status(200).json({ ok: true, data })

  } catch (err) {
    console.error("ERRO GERAL:", err)
    return res.status(500).json({ error: "Erro interno" })
  }

}
