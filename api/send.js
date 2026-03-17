export default async function handler(req,res){

try{

const { telefone, mensagem } = req.body

const url = `https://graph.facebook.com/v19.0/${process.env.PHONE_ID}/messages`

const resp = await fetch(url,{
method:"POST",
headers:{
Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`,
"Content-Type":"application/json"
},
body:JSON.stringify({
messaging_product:"whatsapp",
to:telefone,
type:"text",
text:{ body:mensagem }
})
})

const data = await resp.json()

console.log("ENVIO MANUAL:",data)

return res.json({ok:true})

}catch(e){

console.log("ERRO ENVIO MANUAL:",e)

return res.status(500).json({erro:true})

}

}
