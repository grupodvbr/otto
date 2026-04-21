const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args))
const OpenAI = require("openai")

const VERIFY_TOKEN = process.env.OTTO_VERIFY_TOKEN
const TOKEN = process.env.OTTO_WHATSAPP_TOKEN
const PHONE_ID = process.env.OTTO_PHONE_NUMBER_ID
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

module.exports = async function handler(req, res){

/* ================= VERIFY ================= */

if(req.method === "GET"){
  if(
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === VERIFY_TOKEN
  ){
    return res.status(200).send(req.query["hub.challenge"])
  }
  return res.status(403).end()
}

/* ================= POST ================= */

if(req.method === "POST"){
  try{

    const change = req.body?.entry?.[0]?.changes?.[0]?.value
    if(!change) return res.status(200).end()

    if(change.statuses){
      return res.status(200).end()
    }

    const msg = change.messages?.[0]
    if(!msg) return res.status(200).end()

    const numero = msg.from
    const texto = msg.text?.body || "Mensagem recebida"

    console.log("📩 RECEBIDO:", texto)

/* ================= IA ================= */

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: "Responda curto e direto." },
        { role: "user", content: texto }
      ]
    })

    const resposta = completion.choices[0].message.content

    console.log("🧠 RESPOSTA:", resposta)

/* ================= ENVIO (IGUAL SUA API) ================= */

    const response = await fetch(
      `https://graph.facebook.com/v19.0/${PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: numero,
          type: "text",
          text: { body: resposta }
        })
      }
    )

    const data = await response.json()

    const messageId = data?.messages?.[0]?.id || null
    const sucesso = response.ok && !!messageId

    console.log("📤 ENVIO META:", {
      sucesso,
      messageId,
      respostaMeta: data
    })

/* ================= ERRO REAL ================= */

    if(!sucesso){
      console.error("❌ ERRO REAL WHATSAPP:", data)

      return res.status(200).end()
    }

    return res.status(200).end()

  }catch(e){

    console.error("❌ ERRO GERAL:", e)
    return res.status(500).end()
  }
}

return res.status(405).end()
}
