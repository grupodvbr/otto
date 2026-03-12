const { createClient } = require("@supabase/supabase-js")

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
)

const ADMIN_PHONE = "557798253249"
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID

module.exports = async function handler(req,res){

try{

const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`

/* ================= BUSCAR RESERVAS LINKBIO ================= */

const {data:reservas,error} = await supabase
.from("reservas_mercatto")
.select("*")
.eq("email","linkbio@gmail.com")
.eq("notificado",false)

if(error){
console.log(error)
return res.status(200).json({ok:false})
}

if(!reservas || reservas.length === 0){

console.log("Nenhuma nova reserva LinkBio")

return res.status(200).json({
ok:true,
reservas:0
})

}

/* ================= ENVIAR ALERTAS ================= */

for(const r of reservas){

const dataCliente = new Date(r.datahora)
.toLocaleDateString("pt-BR",{timeZone:"America/Sao_Paulo"})

const horaCliente = new Date(r.datahora)
.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})

const mensagem = 
`🚨 *Nova reserva via LinkBio*

Nome: ${r.nome}
Pessoas: ${r.pessoas}
Mesa: ${r.mesa}

Data: ${dataCliente}
Hora: ${horaCliente}

Telefone: ${r.telefone}

Observações:
${r.observacoes || "Nenhuma"}`

await fetch(url,{

method:"POST",

headers:{
Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`,
"Content-Type":"application/json"
},

body:JSON.stringify({

messaging_product:"whatsapp",

to:ADMIN_PHONE,

type:"text",

text:{
body:mensagem
}

})

})

/* ================= MARCAR COMO NOTIFICADO ================= */

await supabase
.from("reservas_mercatto")
.update({notificado:true})
.eq("id",r.id)

}

console.log("Reservas notificadas:",reservas.length)

return res.status(200).json({
ok:true,
reservas:reservas.length
})

}catch(e){

console.log("ERRO",e)

return res.status(200).json({ok:false})

}

}
