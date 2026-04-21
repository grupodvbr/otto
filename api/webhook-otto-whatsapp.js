import fetch from "node-fetch"

const OTTO_VERIFY_TOKEN = process.env.OTTO_VERIFY_TOKEN
const OTTO_WHATSAPP_TOKEN = process.env.OTTO_WHATSAPP_TOKEN
const OTTO_PHONE_NUMBER_ID = process.env.OTTO_PHONE_NUMBER_ID
const OTTO_AGENT_URL = process.env.OTTO_AGENT_URL
const OTTO_ADMIN_TOKEN = process.env.OTTO_ADMIN_TOKEN

export default async function handler(req, res){

/* ================= VERIFICAÇÃO META ================= */

if(req.method === "GET"){
  if(
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === OTTO_VERIFY_TOKEN
  ){
    return res.status(200).send(req.query["hub.challenge"])
  }
  return res.sendStatus(403)
}

/* ================= RECEBER MENSAGEM ================= */

try{

const body = req.body

const change = body?.entry?.[0]?.changes?.[0]?.value

if(!change){
  return res.sendStatus(200)
}

/* ================= IGNORAR STATUS ================= */

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

console.log("🤖 OTTO RECEBEU:", OTTO_TEXTO)

/* ================= CHAMAR AGENTE ================= */

const OTTO_RESPOSTA_API = await fetch(OTTO_AGENT_URL,{
  method:"POST",
  headers:{
    "Authorization":"Bearer "+OTTO_ADMIN_TOKEN,
    "Content-Type":"application/json"
  },
  body: JSON.stringify({
    pergunta: OTTO_TEXTO
  })
})

const OTTO_JSON = await OTTO_RESPOSTA_API.json()

let OTTO_RESPOSTA_TEXTO = OTTO_JSON.resposta || "Ok"

/* ================= ENVIAR RESPOSTA ================= */

await fetch(`https://graph.facebook.com/v19.0/${OTTO_PHONE_NUMBER_ID}/messages`,{
  method:"POST",
  headers:{
    "Authorization":`Bearer ${OTTO_WHATSAPP_TOKEN}`,
    "Content-Type":"application/json"
  },
  body: JSON.stringify({
    messaging_product:"whatsapp",
    to: OTTO_NUMERO,
    text:{
      body: OTTO_RESPOSTA_TEXTO
    }
  })
})

console.log("📤 OTTO ENVIOU:", OTTO_RESPOSTA_TEXTO)

return res.sendStatus(200)

}catch(e){

console.error("❌ ERRO OTTO:", e)
return res.sendStatus(500)

}

}
