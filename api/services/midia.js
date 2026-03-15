async function enviarTexto(url,token,cliente,texto){

await fetch(url,{
method:"POST",
headers:{
Authorization:`Bearer ${token}`,
"Content-Type":"application/json"
},
body:JSON.stringify({
messaging_product:"whatsapp",
to:cliente,
type:"text",
text:{body:texto}
})
})

}

module.exports = { enviarTexto }
