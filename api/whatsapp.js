const OpenAI = require("openai")
const { createClient } = require("@supabase/supabase-js")

const openai = new OpenAI({
apiKey:process.env.OPENAI_API_KEY
})

const supabase=createClient(
process.env.SUPABASE_URL,
process.env.SUPABASE_SERVICE_ROLE
)

module.exports=async function handler(req,res){

/* ================= WEBHOOK VERIFY ================= */

if(req.method==="GET"){

const verify_token=process.env.VERIFY_TOKEN
const mode=req.query["hub.mode"]
const token=req.query["hub.verify_token"]
const challenge=req.query["hub.challenge"]

if(mode && token===verify_token){
console.log("Webhook verificado")
return res.status(200).send(challenge)
}

return res.status(403).end()

}

/* ================= RECEBER MENSAGEM ================= */

if(req.method==="POST"){

const body=req.body

try{

const change=body.entry?.[0]?.changes?.[0]?.value

if(!change) return res.status(200).end()

if(!change.messages) return res.status(200).end()

const msg=change.messages[0]
const mensagem=msg.text?.body
const cliente=msg.from
const message_id=msg.id

if(!mensagem) return res.status(200).end()

console.log("Cliente:",cliente)
console.log("Mensagem:",mensagem)

/* ================= BLOQUEAR DUPLICADOS ================= */

const {data:duplicado}=await supabase
.from("mensagens_recebidas")
.select("*")
.eq("message_id",message_id)
.single()

if(duplicado){
console.log("Mensagem duplicada ignorada")
return res.status(200).end()
}

await supabase
.from("mensagens_recebidas")
.insert({message_id})

/* ================= DETECTAR NOME ================= */

const nomeDetectado=mensagem.match(/meu nome é (.+)/i)

if(nomeDetectado){

await supabase
.from("clientes_whatsapp")
.upsert({
telefone:cliente,
nome:nomeDetectado[1]
})

}

/* ================= BUSCAR CLIENTE ================= */

const {data:clienteData}=await supabase
.from("clientes_whatsapp")
.select("*")
.eq("telefone",cliente)
.single()

/* ================= SALVAR MENSAGEM ================= */

await supabase
.from("conversas_whatsapp")
.insert({
telefone:cliente,
mensagem:mensagem,
role:"user"
})

/* ================= HISTÓRICO ================= */

const {data:historico}=await supabase
.from("conversas_whatsapp")
.select("*")
.eq("telefone",cliente)
.order("created_at",{ascending:true})
.limit(20)

const mensagens=historico.map(m=>({
role:m.role,
content:m.mensagem
}))

let resposta=""

/* ================= OPENAI ================= */

const completion=await openai.chat.completions.create({

model:"gpt-4.1-mini",

messages:[

{
role:"system",
content:`

Você é o assistente oficial do restaurante Mercatto Delícia.

Atenda clientes de forma natural, simpática e direta.

Evite perguntar repetidamente "posso ajudar em algo".

Se o cliente perguntar algo específico, responda direto.

Use o nome do cliente quando souber.

Cliente atual:
${clienteData?.nome || "nome desconhecido"}

Seu objetivo principal é também fechar reservas.

Para reservas colete:

nome
pessoas
data
hora
area

Aceite variações como:

"área interna"
"salão"
"dentro"
"externa"
"fora"

Quando tiver todos os dados gere:

RESERVA_JSON:
{
"nome":"",
"pessoas":"",
"data":"",
"hora":"",
"area":""
}

Nunca explique o JSON.

`
},

...mensagens

]

})

resposta=completion.choices[0].message.content

console.log("Resposta IA:",resposta)

/* ================= DETECTAR JSON ================= */

try{

const match=resposta.match(/RESERVA_JSON:\s*({[\s\S]*?})/)

if(match){

const reserva=JSON.parse(match[1])

let dataISO=reserva.data

if(reserva.data.includes("/")){

const [dia,mes]=reserva.data.split("/")
const ano=new Date().getFullYear()

dataISO=`${ano}-${mes}-${dia}`

}

let mesa="Salão"

const area=reserva.area.toLowerCase()

if(area.includes("extern") || area.includes("fora")){
mesa="Área Externa"
}

const datahora=dataISO+"T"+reserva.hora

const {error}=await supabase
.from("reservas_mercatto")
.insert({

nome:reserva.nome,
email:"",
telefone:cliente,
pessoas:Number(reserva.pessoas),
mesa:mesa,
cardapio:"",
comandaIndividual:"Não",
datahora:datahora,
observacoes:"Reserva via WhatsApp",
valorEstimado:0,
pagamentoAntecipado:0,
banco:"",
status:"Pendente"

})

if(!error){

resposta=
`✅ Reserva confirmada!

Nome: ${reserva.nome}
Pessoas: ${reserva.pessoas}
Data: ${dataISO}
Hora: ${reserva.hora}
Área: ${mesa}

📍 Mercatto Delícia
Avenida Rui Barbosa 1264

Aguardamos você! 🍷`

}

}

}catch(e){

console.log("Erro reserva:",e)

}

/* ================= SALVAR RESPOSTA ================= */

await supabase
.from("conversas_whatsapp")
.insert({
telefone:cliente,
mensagem:resposta,
role:"assistant"
})

/* ================= ENVIAR WHATSAPP ================= */

const phone_number_id=change.metadata.phone_number_id

const url=`https://graph.facebook.com/v19.0/${phone_number_id}/messages`

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
text:{body:resposta}

})

})

}catch(e){

console.log("ERRO GERAL:",e)

}

return res.status(200).end()

}

}
