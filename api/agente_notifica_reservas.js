const OpenAI = require("openai")
const { createClient } = require("@supabase/supabase-js")

const openai = new OpenAI({
apiKey: process.env.OPENAI_API_KEY
})

const supabase = createClient(
process.env.SUPABASE_URL,
process.env.SUPABASE_SERVICE_ROLE
)

const ADMIN = "5577998253249"

module.exports = async function handler(req,res){

/* ================= WEBHOOK VERIFY ================= */

if(req.method==="GET"){

const verify_token = process.env.VERIFY_TOKEN
const mode = req.query["hub.mode"]
const token = req.query["hub.verify_token"]
const challenge = req.query["hub.challenge"]

if(mode && token===verify_token){
return res.status(200).send(challenge)
}

return res.status(403).end()

}

/* ================= RECEBER MENSAGEM ================= */

if(req.method==="POST"){

const body=req.body

try{

const change = body.entry?.[0]?.changes?.[0]?.value

if(!change || !change.messages){
return res.status(200).end()
}

const msg = change.messages[0]

const cliente = msg.from
const mensagem = msg.text?.body || ""

const phone_number_id = change.metadata.phone_number_id

const url = `https://graph.facebook.com/v19.0/${phone_number_id}/messages`

/* ================= BLOQUEAR OUTROS NÚMEROS ================= */

if(cliente !== ADMIN){

return res.status(200).end()

}

/* ================= BUSCAR RESERVAS ================= */

const {data:reservas} = await supabase
.from("reservas_mercatto")
.select("*")
.order("datahora",{ascending:true})

/* ================= FORMATAR PARA IA ================= */

const dadosReservas = reservas.map(r=>({

nome:r.nome,
pessoas:r.pessoas,
area:r.mesa,
telefone:r.telefone,
datahora:r.datahora,
observacoes:r.observacoes,
status:r.status

}))

/* ================= OPENAI ================= */

const completion = await openai.chat.completions.create({

model:"gpt-4.1-mini",

messages:[

{
role:"system",
content:`

Você é um assistente administrativo do restaurante Mercatto Delícia.

Sua função é informar dados das reservas.

Você não pode alterar reservas.
Você não pode criar reservas.
Você não pode cancelar reservas.

Você apenas consulta e responde.

Sempre responda usando apenas os dados fornecidos.

Se perguntarem:

quantas reservas hoje  
→ conte as reservas da data atual

quem reservou  
→ liste os nomes

quantas pessoas no total  
→ some todas as pessoas

Se pedirem detalhes mostre:

Nome
Pessoas
Área
Telefone
Data
Observações

Responda de forma clara e organizada.

`
},

{
role:"user",
content:`Pergunta: ${mensagem}

Reservas no sistema:

${JSON.stringify(dadosReservas,null,2)}

`

}

]

})

const resposta = completion.choices[0].message.content

/* ================= ENVIAR WHATSAPP ================= */

await fetch(url,{

method:"POST",

headers:{
Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`,
"Content-Type":"application/json"
},

body:JSON.stringify({

messaging_product:"whatsapp",

to:cliente,

type:"text",

text:{
body:resposta
}

})

})

}catch(e){

console.log("ERRO",e)

}

return res.status(200).end()

}

}
