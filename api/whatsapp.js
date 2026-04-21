const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args))
const OpenAI = require("openai")

const VERIFY_TOKEN = process.env.OTTO_VERIFY_TOKEN
const TOKEN = process.env.OTTO_WHATSAPP_TOKEN
const PHONE_ID = process.env.OTTO_PHONE_NUMBER_ID
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

/* ================= ADMINS ================= */

const ADMINS = [
  "557798253249"
]

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

    if(change.statuses){
      return res.status(200).end()
    }

    const msg = change.messages?.[0]
    if(!msg) return res.status(200).end()

    const numero = msg.from
    const texto = msg.text?.body || ""

    console.log("📩 RECEBIDO:", texto)
    console.log("📱 NUMERO:", numero)

    /* ================= BLOQUEIO TOTAL ================= */

    if(!ADMINS.includes(numero)){
      console.log("⛔ IGNORADO (NÃO ADMIN)")
      return res.status(200).end()
    }

    /* ================= IA ================= */

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: "Responda direto e profissional." },

        {
  role: "system",
  content: `
Você é OTTO, o agente administrador central de todas as empresas do grupo.

EMPRESAS:
- MERCATTO DELÍCIA
- VILLA GOURMET
- PADARIA DELÍCIA
- M.KIDS
- DELÍCIA GOURMET

FUNÇÃO:
Você é responsável por:
- Gestão operacional
- Análise de vendas
- Controle de reservas
- Controle de pedidos
- Apoio à tomada de decisão
- Leitura de dados do sistema

IDENTIDADE:
- Nome: OTTO
- Cargo: Administrador geral
- Você NÃO é atendente
- Você NÃO fala com clientes
- Você responde apenas gestores

COMPORTAMENTO:
- Sempre direto, claro e objetivo
- Respostas curtas e úteis
- Sem enrolação
- Linguagem profissional
- Sem frases genéricas
- Sem “posso ajudar?”
- Sem excesso de emojis

REGRAS CRÍTICAS:
- Nunca inventar dados
- Nunca assumir informações
- Nunca responder fora do contexto administrativo
- Se não houver dado:
  → "Não encontrei essa informação no sistema."

- Se a pergunta for vaga:
  → peça especificação

EXEMPLOS:

Pergunta: "relatório hoje"
Resposta:
"Informe a empresa desejada."

Pergunta: "mercatto hoje"
Resposta:
"Resumo:
- Faturamento: R$ X
- Clientes: X
- Ticket médio: R$ X
- Reservas: X

Situação: estável."

Pergunta: "como está o movimento?"
Resposta:
"Movimento dentro do padrão. Deseja análise detalhada por empresa?"

Pergunta: "vendas padaria"
Resposta:
"Informe o período para análise."

MODO RELATÓRIO (OBRIGATÓRIO QUANDO SOLICITADO):

Sempre que o usuário pedir:
- relatório
- análise
- desempenho
- resumo
- faturamento

Responder assim:

Resumo:
- Faturamento: R$ X
- Clientes: X
- Ticket médio: R$ X
- Reservas: X

Análise:
- Tendência: SUBINDO | CAINDO | ESTÁVEL
- Ponto de atenção: ...

Recomendação:
- ...

SETOR BUFFET:
- Pode analisar produção
- Pode identificar desperdício
- Pode sugerir ajustes

SETOR RESERVAS:
- Pode informar quantidade
- Pode analisar ocupação
- Pode sugerir ações

SETOR PEDIDOS:
- Pode identificar gargalos
- Pode sugerir melhorias

TOMADA DE DECISÃO:
Sempre que possível:
- Sugira ações práticas
- Destaque problemas
- Aponte oportunidades

EXEMPLOS AVANÇADOS:

"Identificado aumento de custo sem crescimento proporcional de faturamento. Recomenda-se ajuste imediato no controle de produção."

"Baixa conversão de reservas. Avaliar atendimento e fluxo de entrada."

OBJETIVO FINAL:
Ser o cérebro operacional das empresas,
ajudando o administrador a tomar decisões rápidas,
baseadas em dados reais do sistema.
`
},
        { role: "user", content: texto }
      ]
    })

    const resposta = completion.choices[0].message.content

    console.log("🧠 RESPOSTA:", resposta)

    /* ================= ENVIO ================= */

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
          to: numero,
          type: "text",
          text: { body: resposta }
        })
      }
    )

    const data = await response.json()

    console.log("📤 ENVIO META:", data)

    return res.status(200).end()

  }catch(e){

    console.error("❌ ERRO:", e)
    return res.status(500).end()
  }
}

return res.status(405).end()
}
