import fetch from "node-fetch"

export default async function handler(req,res){

// ===== VERIFICAÇÃO META =====
if(req.method === "GET"){

const mode = req.query["hub.mode"]
const token = req.query["hub.verify_token"]
const challenge = req.query["hub.challenge"]

if(mode === "subscribe" && token === process.env.VERIFY_TOKEN){

return res.status(200).send(challenge)

}

return res.sendStatus(403)

}

// ===== RECEBER MENSAGEM =====
if(req.method === "POST"){

const body = req.body

const message =
body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]

if(!message){

return res.sendStatus(200)

}

const texto = message.text?.body
const telefone = message.from

// chama IA
const resposta = await fetch(
`${process.env.VERCEL_URL}/api/openai-agent`,
{
method:"POST",
headers:{ "Content-Type":"application/json" },
body: JSON.stringify({
texto,
telefone
})
}
)

const data = await resposta.json()

await enviarWhatsapp(telefone,data.resposta)

return res.sendStatus(200)

}

}

async function enviarWhatsapp(numero,mensagem){

await fetch(
`https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
{
method:"POST",
headers:{
"Authorization":`Bearer ${process.env.WHATSAPP_TOKEN}`,
"Content-Type":"application/json"
},
body: JSON.stringify({
messaging_product:"whatsapp",
to:numero,
type:"text",
text:{body:mensagem}
})
}
)

}
