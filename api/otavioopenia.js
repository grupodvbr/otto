import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" })
  }

  try {

    const { mensagem, telefone, origem } = req.body

    if (!mensagem) {
      return res.status(400).json({ error: "Mensagem obrigatória" })
    }

    const msgLower = mensagem.toLowerCase()

    /* =========================================================
       🔒 BLOQUEIO CRÍTICO — SALA VIP (NUNCA INVENTA)
    ========================================================= */

    const assuntoVIP =
      msgLower.includes("vip") ||
      msgLower.includes("sala") ||
      msgLower.includes("paulo augusto")

    if (assuntoVIP) {

      return res.status(200).json({
        resposta:
`Claro! Vou verificar a disponibilidade da sala pra você agora 😊

Pode me informar:
• Data
• Horário
• Quantidade de pessoas`
      })
    }

    /* =========================================================
       🧠 PROMPT BASE
    ========================================================= */

    const prompt = `
Você é o assistente oficial do restaurante Mercatto Delícia.

REGRAS OBRIGATÓRIAS:

- Nunca diga que é IA
- Responder como humano
- Linguagem de WhatsApp
- Ser direto e elegante
- Evitar textos longos
- Sempre tentar converter em reserva ou venda

⚠️ REGRA CRÍTICA:
Se o assunto for sala VIP:
- Nunca informar disponibilidade
- Nunca assumir nada
- Sempre dizer que vai verificar

SALAS:
- Sala Paulo Augusto 1 (prioridade)
- Sala Paulo Augusto 2

CONTEXTO:
Telefone: ${telefone || "não informado"}
Origem: ${origem || "desconhecida"}

CLIENTE:
${mensagem}

RESPONDA:
Como um atendente real do Mercatto.
`

    /* =========================================================
       🤖 CHAMADA OPENAI
    ========================================================= */

    const completion = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: prompt
    })

    let resposta = completion.output_text || "Desculpe, não entendi."

    /* =========================================================
       🎯 AJUSTE FINAL POR ORIGEM
    ========================================================= */

    if (origem === "whatsapp") {
      // mais curto
      resposta = resposta.substring(0, 300)
    }

    if (origem === "painel") {
      // pode ser mais explicativo
      resposta = resposta
    }

    /* =========================================================
       📊 LOG
    ========================================================= */

    console.log("📩 Pergunta:", mensagem)
    console.log("📞 Telefone:", telefone)
    console.log("📍 Origem:", origem)
    console.log("🤖 Resposta:", resposta)

    return res.status(200).json({
      resposta
    })

  } catch (err) {

    console.error("❌ ERRO OTAVIO:", err)

    return res.status(500).json({
      resposta: "Tive um problema aqui 😕 Pode repetir pra mim?"
    })
  }
}
