const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args))

/* ================= IMPORTA SEU AGENTE ================= */

const ADMIN_ALERTA = "5577998253249"

/* ================= ENVIO ================= */

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
    return res.status(200).send(req.query["hub.challenge"])
  }
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

    const numero = msg.from
    const texto = msg.text?.body || "[mensagem não textual]"

    console.log("📩 RECEBIDO:", texto)
    console.log("📱 NUMERO:", numero)

    /* ======================================================
       ❌ NÃO ADMIN → ALERTA E IGNORA
    ====================================================== */

    if(!ADMINS.includes(numero)){

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
       🧠 CHAMA SEU AGENTE DIRETO (SEM FETCH)
    ====================================================== */

    let resposta = "Erro ao processar"

    const fakeReq = {
      method: "POST",
      headers: {
        authorization: "Bearer " + ADMIN_TOKEN
      },
      body: {
        pergunta: texto
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
       📤 ENVIA RESPOSTA
    ====================================================== */

    await enviarMensagem(numero, resposta)

    return res.status(200).end()

  }catch(e){

    console.error("❌ ERRO GERAL:", e)
    return res.status(500).end()
  }
}

/* ================= FALLBACK ================= */

return res.status(405).end()
}
