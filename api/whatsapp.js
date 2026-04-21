const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args))
const OpenAI = require("openai")

const VERIFY_TOKEN = process.env.OTTO_VERIFY_TOKEN
const TOKEN = process.env.OTTO_WHATSAPP_TOKEN
const PHONE_ID = process.env.OTTO_PHONE_NUMBER_ID
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

/* ================= ADMINS ================= */

const ADMINS = [
  "557798253249"
]

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
    const texto = msg.text?.body || ""

    console.log("📩 RECEBIDO:", texto)
    console.log("📱 NUMERO:", numero)

    /* ================= BLOQUEIO TOTAL ================= */

    if(!ADMINS.includes(numero)){
      console.log("⛔ IGNORADO (NÃO ADMIN)")
      return res.status(200).end()
    }

    /* ================= IA ================= */

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: "Responda direto e profissional." },

        {
  role: "system",
  content: `
Você é OTTO, o agente administrador do sistema do Mercatto Delícia.

IDENTIDADE:
- Nome: OTTO
- Função: Assistente administrativo e gestor
- Você não é um atendente comum
- Você responde apenas administradores

COMPORTAMENTO:
- Sempre responda de forma direta, clara e objetiva
- Evite textos longos desnecessários
- Fale como um gestor experiente
- Seja profissional, firme e inteligente
- Não use emojis em excesso (no máximo 1 se necessário)
- Não seja informal demais

REGRAS CRÍTICAS:
- Nunca invente dados
- Nunca “ache” informações
- Se não souber, diga: "Não encontrei essa informação no sistema"
- Não responda coisas fora do contexto administrativo
- Não fale como chatbot genérico

ESTILO DE RESPOSTA:
- Respostas curtas e úteis
- Pode usar listas quando necessário
- Pode sugerir ações

EXEMPLOS DE TOM:

Pergunta: "como está o movimento?"
Resposta:
"O movimento está dentro do esperado para o período. Deseja um relatório detalhado?"

Pergunta: "quantas reservas hoje?"
Resposta:
"Hoje temos X reservas registradas."

Pergunta: "analise de vendas"
Resposta:
"Resumo:
- Faturamento: R$ X
- Clientes: X
- Ticket médio: R$ X

Situação: estável."

OBJETIVO:
Ajudar o administrador a tomar decisões rápidas com base nas informações disponíveis.
`
},
        { role: "user", content: texto }
      ]
    })

    const resposta = completion.choices[0].message.content

    console.log("🧠 RESPOSTA:", resposta)

    /* ================= ENVIO ================= */

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

    console.log("📤 ENVIO META:", data)

    return res.status(200).end()

  }catch(e){

    console.error("❌ ERRO:", e)
    return res.status(500).end()
  }
}

return res.status(405).end()
}
