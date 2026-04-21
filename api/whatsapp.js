import fetch from "node-fetch"

/* ================= ENV ================= */

const VERIFY_TOKEN = process.env.OTTO_VERIFY_TOKEN
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN
const PHONE_NUMBER_ID = process.env.OTTO_PHONE_NUMBER_ID

const OTTO_ADMIN_TOKEN = process.env.OTTO_ADMIN_TOKEN

// 👉 URL DO SEU AGENTE (EXATO)
const OTTO_AGENT_URL = process.env.OTTO_AGENT_URL 
// Ex: https://seu-projeto.vercel.app/api/admin-agente

/* ================= ADMINS ================= */

const OTTO_ADMINS = [
  "557798253249"
]

const OTTO_NUMERO_RESTAURANTE = "5577999229807"

/* ================= HANDLER ================= */

export default async function handler(req, res){

/* ======================================================
   🔐 VERIFICAÇÃO META (GET)
====================================================== */

if(req.method === "GET"){
  const mode = req.query["hub.mode"]
  const token = req.query["hub.verify_token"]
  const challenge = req.query["hub.challenge"]

  if(mode === "subscribe" && token === VERIFY_TOKEN){
    console.log("✅ OTTO WEBHOOK VALIDADO")
    return res.status(200).send(challenge)
  }

  console.log("❌ VERIFY TOKEN INVALIDO")
  return res.sendStatus(403)
}

/* ======================================================
   📥 EVENTO WHATSAPP (POST)
====================================================== */

if(req.method === "POST"){

  try{

    const body = req.body

    const change = body?.entry?.[0]?.changes?.[0]?.value

    if(!change){
      return res.sendStatus(200)
    }

    /* ================= STATUS ================= */

    if(change.statuses){
      console.log("📩 OTTO STATUS:", change.statuses[0].status)
      return res.sendStatus(200)
    }

    /* ================= MENSAGEM ================= */

    const msg = change.messages?.[0]

    if(!msg){
      return res.sendStatus(200)
    }

    const OTTO_NUMERO = msg.from
    const OTTO_TIPO = msg.type

    let OTTO_TEXTO = ""

    /* ================= TEXTO ================= */

    if(OTTO_TIPO === "text"){
      OTTO_TEXTO = msg.text.body
    }

    /* ================= IMAGEM ================= */

    if(OTTO_TIPO === "image"){
      OTTO_TEXTO = "[imagem enviada]"
    }

    /* ================= AUDIO ================= */

    if(OTTO_TIPO === "audio"){
      OTTO_TEXTO = "[audio enviado]"
    }

    if(!OTTO_TEXTO){
      OTTO_TEXTO = "[mensagem não suportada]"
    }

    console.log("🤖 OTTO RECEBEU:", OTTO_TEXTO)
    console.log("📱 DE:", OTTO_NUMERO)

    /* ======================================================
       🔐 BLOQUEIO DE NÃO ADMIN
    ====================================================== */

    const OTTO_EH_ADMIN = OTTO_ADMINS.includes(OTTO_NUMERO)

    if(!OTTO_EH_ADMIN){

      console.log("⛔ OTTO BLOQUEOU NÃO ADMIN:", OTTO_NUMERO)

      await fetch(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,{
        method:"POST",
        headers:{
          "Authorization":`Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type":"application/json"
        },
        body: JSON.stringify({
          messaging_product:"whatsapp",
          to: OTTO_NUMERO,
          text:{
            body:
`Olá! 👋

Para atendimento, fale com o Mercatto Delícia:

📞 (77) 99922-9807

Obrigado!`
          }
        })
      })

      return res.sendStatus(200)
    }

    /* ======================================================
       🧠 CHAMAR SEU AGENTE (admin-agente.js)
    ====================================================== */

    console.log("🧠 OTTO CHAMANDO AGENTE...")

    const respostaAPI = await fetch(OTTO_AGENT_URL,{
      method:"POST",
      headers:{
        "Authorization":"Bearer "+OTTO_ADMIN_TOKEN,
        "Content-Type":"application/json"
      },
      body: JSON.stringify({
        pergunta: OTTO_TEXTO
      })
    })

    const json = await respostaAPI.json()

    let OTTO_RESPOSTA = json?.resposta || "Ok"

    console.log("🧠 OTTO RESPOSTA:", OTTO_RESPOSTA)

    /* ======================================================
       📤 ENVIAR RESPOSTA WHATSAPP
    ====================================================== */

    await fetch(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,{
      method:"POST",
      headers:{
        "Authorization":`Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type":"application/json"
      },
      body: JSON.stringify({
        messaging_product:"whatsapp",
        to: OTTO_NUMERO,
        text:{
          body: OTTO_RESPOSTA
        }
      })
    })

    console.log("📤 OTTO ENVIOU:", OTTO_RESPOSTA)

    return res.sendStatus(200)

  }catch(e){

    console.error("❌ ERRO OTTO:", e)
    return res.sendStatus(500)

  }

}

/* ======================================================
   ❌ MÉTODO INVÁLIDO
====================================================== */

return res.sendStatus(405)

}
