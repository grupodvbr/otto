

const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args))

// 🔥 AQUI
const fs = require("fs")

const OpenAI = require("openai")

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})



/* ================= IMPORTA AGENTE ================= */

const adminAgente = require("./admin-agente")

/* ================= ENV ================= */

const VERIFY_TOKEN = process.env.OTTO_VERIFY_TOKEN
const TOKEN = process.env.OTTO_WHATSAPP_TOKEN
const PHONE_ID = process.env.OTTO_PHONE_NUMBER_ID
const ADMIN_TOKEN = process.env.ADMIN_TOKEN

/* ================= ADMINS ================= */

const ADMINS = [
  "557798253249",
  "557799761436"
]
// 🔥 ALERTA SEMPRE VAI PRAQUI
const ADMIN_ALERTA = "557798253249"

/* ================= NORMALIZA NUMERO ================= */

function normalizar(numero){
  return (numero || "").replace(/\D/g, "")
}

/* ================= ENVIO WHATSAPP ================= */

async function enviarMensagem(para, texto){
  try{

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
          to: para,
          type: "text",
          text: { body: texto }
        })
      }
    )

    const data = await response.json()

    console.log("📤 ENVIO META:", {
      para,
      sucesso: response.ok,
      respostaMeta: data
    })

  }catch(e){
    console.error("❌ ERRO ENVIO:", e)
  }
}

/* ================= HANDLER ================= */

module.exports = async function handler(req, res){

/* ================= VERIFY ================= */

if(req.method === "GET"){
  if(
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === VERIFY_TOKEN
  ){
    console.log("✅ WEBHOOK VALIDADO")
    return res.status(200).send(req.query["hub.challenge"])
  }

  console.log("❌ VERIFY TOKEN INVALIDO")
  return res.status(403).end()
}

/* ================= POST ================= */

if(req.method === "POST"){
  try{

    const change = req.body?.entry?.[0]?.changes?.[0]?.value
    if(!change) return res.status(200).end()

    // ignora status
    if(change.statuses){
      return res.status(200).end()
    }

const msg = change.messages?.[0]
if(!msg) return res.status(200).end()

const numero = normalizar(msg.from).slice(-13)

let texto = msg.text?.body || null

// 🎤 TRATAMENTO DE ÁUDIO
if(msg.type === "audio"){

  console.log("🎤 AUDIO RECEBIDO")

  const mediaId = msg.audio.id

  // 1. BUSCA URL DO AUDIO
  const mediaRes = await fetch(
    `https://graph.facebook.com/v19.0/${mediaId}`,
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`
      }
    }
  )

  const mediaJson = await mediaRes.json()

  // 2. BAIXA AUDIO
  const audioBuffer = await fetch(mediaJson.url, {
    headers: {
      Authorization: `Bearer ${TOKEN}`
    }
  }).then(r => r.arrayBuffer())

  // 3. SALVA TEMPORÁRIO
  const filePath = "/tmp/audio.ogg"
  fs.writeFileSync(filePath, Buffer.from(audioBuffer))

  // 4. TRANSCRIÇÃO
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: "gpt-4o-mini-transcribe"
  })

  texto = transcription.text
if(!texto || texto.trim() === ""){
  texto = "Não consegui entender o áudio"
}
  console.log("📝 TEXTO DO AUDIO:", texto)
}

// fallback
if(!texto || texto.trim() === ""){
  texto = "Não consegui entender o áudio"
}



    

    

    console.log("📩 RECEBIDO:", texto)
    console.log("📱 NUMERO:", numero)

    /* ================= VALIDA ADMIN ================= */

    const ehAdmin = ADMINS.includes(numero)

    console.log("🔐 EH ADMIN:", ehAdmin)

    /* ======================================================
       ❌ NÃO ADMIN → ALERTA E IGNORA
    ====================================================== */

    if(!ehAdmin){

      console.log("⛔ NÃO ADMIN - ALERTANDO")

      await enviarMensagem(
        ADMIN_ALERTA,
`🚨 CONTATO NÃO AUTORIZADO

📱 Número: ${numero}
💬 Mensagem: ${texto}`
      )

      return res.status(200).end()
    }

    /* ======================================================
       🧠 CHAMA SEU AGENTE (LOCAL)
    ====================================================== */

    let resposta = "Erro ao processar"

const fakeReq = {
  method: "POST",
  query: {}, // 🔥 CORREÇÃO CRÍTICA
  headers: {
    authorization: "Bearer " + ADMIN_TOKEN
  },
  body: {
    pergunta: texto,
    numero: numero
  }
}

    const fakeRes = {
      json: (data) => {
        resposta = data?.resposta || resposta
      },
      status: () => ({
        json: () => {}
      })
    }

    await adminAgente(fakeReq, fakeRes)

    console.log("🧠 RESPOSTA:", resposta)

    /* ======================================================
       📤 ENVIA RESPOSTA WHATSAPP
    ====================================================== */

    await enviarMensagem(numero, resposta)

    console.log("✅ RESPONDIDO COM SUCESSO")

    return res.status(200).end()

  }catch(e){

    console.error("❌ ERRO GERAL:", e)
    return res.status(500).end()
  }
}

/* ================= FALLBACK ================= */

return res.status(405).end()
}
