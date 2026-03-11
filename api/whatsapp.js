const OpenAI = require("openai")

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

module.exports = async function handler(req, res) {

  if (req.method === "GET") {

    const verify_token = process.env.VERIFY_TOKEN
    const mode = req.query["hub.mode"]
    const token = req.query["hub.verify_token"]
    const challenge = req.query["hub.challenge"]

    if (mode && token === verify_token) {
      return res.status(200).send(challenge)
    }

    return res.sendStatus(403)
  }

  if (req.method === "POST") {

    const body = req.body

    console.log("Webhook recebido:", JSON.stringify(body,null,2))

    try {

      const mensagem =
        body.entry[0].changes[0].value.messages[0].text.body

      const cliente =
        body.entry[0].changes[0].value.messages[0].from

      console.log("Cliente:", cliente)
      console.log("Mensagem:", mensagem)

      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: `
Você é o assistente de reservas do restaurante Mercatto Delícia.

Responda clientes de forma educada e curta.

Informações do restaurante:

Rodízio italiano
Rodízio oriental
Reservas disponíveis

Locais:
Sala VIP 1
Sala VIP 2
Sacada
Salão Central
`
          },
          {
            role: "user",
            content: mensagem
          }
        ]
      })

      const resposta =
        completion.choices[0].message.content

      console.log("Resposta IA:", resposta)

      const phone_number_id =
        body.entry[0].changes[0].value.metadata.phone_number_id

      const url =
        `https://graph.facebook.com/v19.0/${phone_number_id}/messages`

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: cliente,
          type: "text",
          text: {
            body: resposta
          }
        })
      })

      const data = await response.json()

      console.log("META RESPONSE:", data)

    } catch (error) {
      console.error("ERRO:", error)
    }

    return res.sendStatus(200)
  }

}
