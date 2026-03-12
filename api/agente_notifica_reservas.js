const { createClient } = require("@supabase/supabase-js")

const supabase = createClient(
process.env.SUPABASE_URL,
process.env.SUPABASE_SERVICE_ROLE
)

const WHATSAPP_ADMIN = "5577998253249"

module.exports = async function handler(req,res){

try{

/* ================= BUSCAR RESERVAS NÃO NOTIFICADAS ================= */

const { data: reservas } = await supabase
.from("reservas_mercatto")
.select("*")
.eq("email","linkbio@gmail.com")
.eq("notificado",false)

if(!reservas || reservas.length === 0){

return res.status(200).json({
status:"nenhuma reserva nova"
})

}

/* ================= ENVIAR ALERTAS ================= */

for(const r of reservas){

const dataCliente = new Date(r.datahora)
.toLocaleDateString("pt-BR",{timeZone:"America/Sao_Paulo"})

const horaCliente = new Date(r.datahora)
.toLocaleTimeString("pt-BR",{
hour:"2-digit",
minute:"2-digit",
timeZone:"America/Sao_Paulo"
})

const mensagem =
`🔔 NOVA RESERVA MERCATTO

Nome: ${r.nome}
Pessoas: ${r.pessoas}
Data: ${dataCliente}
Hora: ${horaCliente}
Área: ${r.mesa}

Telefone cliente:
${r.telefone}

Status: ${r.status}`

const url = `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`

await fetch(url,{
method:"POST",
headers:{
Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`,
"Content-Type":"application/json"
},
body:JSON.stringify({
messaging_product:"whatsapp",
to:WHATSAPP_ADMIN,
type:"text",
text:{body:mensagem}
})
})

/* ================= MARCAR COMO NOTIFICADA ================= */

await supabase
.from("reservas_mercatto")
.update({ notificado:true })
.eq("id",r.id)

}

/* ================= RESPOSTA ================= */

return res.status(200).json({
status:"notificações enviadas",
quantidade:reservas.length
})

}catch(e){

console.log("ERRO AGENTE",e)

return res.status(500).json({
erro:"erro no agente"
})

}

}
