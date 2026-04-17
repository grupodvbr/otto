import fetch from "node-fetch"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
)

export default async function handler(req, res){

  if(req.method !== "POST"){
    return res.status(405).json({ error: "Método não permitido" })
  }

  try{

    /* ================= BODY SEGURO ================= */

    const body = typeof req.body === "string"
      ? JSON.parse(req.body)
      : req.body

    const {
      telefone,
      mensagem,
      media_url,
      tipo,
      nome_arquivo
    } = body || {}

    /* ================= VALIDAÇÕES ================= */

    if(!telefone){
      return res.status(400).json({
        error: "Telefone obrigatório"
      })
    }

    const telefoneFormatado = telefone.replace(/\D/g, "")

    if(!telefoneFormatado){
      return res.status(400).json({
        error: "Telefone inválido"
      })
    }

    const TOKEN = process.env.WHATSAPP_TOKEN
    const PHONE_ID = process.env.PHONE_NUMBER_ID

    if(!TOKEN || !PHONE_ID){
      return res.status(500).json({
        error: "Credenciais do WhatsApp não configuradas"
      })
    }

    const url = `https://graph.facebook.com/v19.0/${PHONE_ID}/messages`

    /* ================= MAPEAR TIPO ================= */

    const tipoMap = {
      texto: "text",
      imagem: "image",
      video: "video",
      audio: "audio",
      documento: "document"
    }

    const tipoConvertido = tipoMap[tipo] || "text"

    /* ================= MONTAR PAYLOAD ================= */

    let payload = {
      messaging_product: "whatsapp",
      to: telefoneFormatado
    }

    // 📩 TEXTO
    if(!media_url){

      if(!mensagem){
        return res.status(400).json({
          error: "Mensagem vazia não permitida"
        })
      }

      payload.type = "text"
      payload.text = {
        body: mensagem
      }
    }

    // 📎 MIDIA
    else{

      payload.type = tipoConvertido

      if(tipoConvertido === "image"){
        payload.image = {
          link: media_url,
          caption: mensagem || ""
        }
      }

      if(tipoConvertido === "video"){
        payload.video = {
          link: media_url,
          caption: mensagem || ""
        }
      }

      if(tipoConvertido === "audio"){
        payload.audio = {
          link: media_url
        }
      }

      if(tipoConvertido === "document"){
        payload.document = {
          link: media_url,
          filename: nome_arquivo || "arquivo"
        }
      }
    }

    /* ================= LOG ================= */

    console.log("📤 PAYLOAD:", JSON.stringify(payload, null, 2))

    /* ================= ENVIO META ================= */

    const response = await fetch(url,{
      method:"POST",
      headers:{
        Authorization:`Bearer ${TOKEN}`,
        "Content-Type":"application/json"
      },
      body: JSON.stringify(payload)
    })

    const data = await response.json()

    console.log("📩 META RESPONSE:", data)

    /* ================= ERRO META ================= */

    if(!response.ok){

      console.error("❌ ERRO WHATSAPP:", data)

      return res.status(400).json({
        error: "Erro ao enviar mensagem",
        details: data
      })
    }

    const messageId = data?.messages?.[0]?.id || null

    /* ================= SALVAR NO BANCO ================= */

    try{

      await supabase
      .from("conversas_whatsapp")
      .insert({
        telefone: telefoneFormatado,
        mensagem: mensagem || "[MIDIA]",
        tipo: tipo || "texto",
        media_url,
        nome_arquivo,
        role: "assistant",
        message_id: messageId,
        status: "sent"
      })

    }catch(dbError){
      console.error("⚠️ ERRO AO SALVAR NO BANCO:", dbError)
    }

    /* ================= SUCESSO ================= */

    return res.status(200).json({
      success: true,
      message_id: messageId,
      data
    })

  }catch(e){

    console.error("🔥 ERRO INTERNO COMPLETO:", e)
    console.error("STACK:", e?.stack)

    return res.status(500).json({
      error: "Erro interno",
      details: e.message
    })
  }
}
