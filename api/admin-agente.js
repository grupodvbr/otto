const OpenAI = require("openai")
const { createClient } = require("@supabase/supabase-js")

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
)

const ADMIN_TOKEN = process.env.ADMIN_TOKEN

module.exports = async function handler(req, res){

try{

/* ================= AUTH ================= */

if(req.headers.authorization !== `Bearer ${ADMIN_TOKEN}`){
  return res.status(403).json({ erro: "acesso negado" })
}

/* ================= BODY ================= */

const body = typeof req.body === "string"
  ? JSON.parse(req.body)
  : req.body

const pergunta = body?.pergunta || ""
const numero = body?.numero

if(!numero){
  return res.json({ resposta: "Número não informado" })
}

/* ================= USUARIO ================= */

const { data: usuario } = await supabase
  .from("usuarios_do_sistema")
  .select("*")
  .eq("telefone", numero)
  .eq("ativo", true)
  .maybeSingle()

if(!usuario){
  return res.json({ resposta: "Usuário não autorizado" })
}

const NIVEL = usuario.nivel_acesso

if(NIVEL !== 0){
  return res.json({ resposta: "⛔ Apenas nível 0 permitido" })
}

/* ================= BUSCA GLOBAL (SEM FILTRO) ================= */

const [
  reservas,
  pedidos,
  clientes,
  produtos,
  buffet,
  musicos,
  usuariosSistema,
  prompts
] = await Promise.all([

  supabase.from("reservas_mercatto").select("*").limit(1000),
  supabase.from("pedidos").select("*").limit(1000),
  supabase.from("memoria_clientes").select("*").limit(1000),
  supabase.from("produtos").select("*").limit(1000),
  supabase.from("buffet_lancamentos").select("*").limit(1000),
  supabase.from("agenda_musicos").select("*").limit(1000),
  supabase.from("usuarios_do_sistema").select("*"),
  supabase.from("prompt_agente").select("*").eq("ativo", true).order("ordem",{ascending:true})

])

/* ================= PROMPT ================= */

const promptFinal = (prompts.data || [])
  .map(p => p.prompt)
  .join("\n\n")

/* ================= CONTEXTO ================= */

const contextos = [
  {
    role:"system",
    content:`
USUARIO:
${JSON.stringify(usuario)}

⚠️ REGRA:
- Você deve usar APENAS os dados abaixo
- Nunca inventar
- Toda lógica está nos prompts
`
  },

  {
    role:"system",
    content:"RESERVAS:\n" + JSON.stringify(reservas.data || [])
  },

  {
    role:"system",
    content:"PEDIDOS:\n" + JSON.stringify(pedidos.data || [])
  },

  {
    role:"system",
    content:"CLIENTES:\n" + JSON.stringify(clientes.data || [])
  },

  {
    role:"system",
    content:"PRODUTOS:\n" + JSON.stringify(produtos.data || [])
  },

  {
    role:"system",
    content:"BUFFET:\n" + JSON.stringify(buffet.data || [])
  },

  {
    role:"system",
    content:"MUSICOS:\n" + JSON.stringify(musicos.data || [])
  },

  {
    role:"system",
    content:"USUARIOS_SISTEMA:\n" + JSON.stringify(usuariosSistema.data || [])
  },

  {
    role:"system",
    content:`PROMPT_MASTER:\n${promptFinal}`
  },

  {
    role:"user",
    content: pergunta
  }
]

/* ================= GPT ================= */

const completion = await openai.chat.completions.create({
  model: "gpt-4.1-mini",
  temperature: 0,
  messages: contextos
})

let resposta = completion.choices[0].message.content

/* ================= DETECTAR AÇÃO ================= */

let acao = null

const match = resposta.match(/AÇÃO_JSON:\s*([\s\S]*)/)

if(match){

  try{

    let json = match[1]
      .replace(/```json/g,"")
      .replace(/```/g,"")
      .trim()

    const inicio = json.indexOf("{")
    const fim = json.lastIndexOf("}")

    json = json.substring(inicio, fim + 1)

    acao = JSON.parse(json)

  }catch(e){
    console.log("Erro parse ação")
  }
}

/* ================= SALVAR CHAT ================= */

await supabase
.from("assistente_otto_chat")
.insert({
  role: "user",
  mensagem: pergunta,
  telefone: numero,
  usuario_id: usuario.id
})

await supabase
.from("assistente_otto_chat")
.insert({
  role: "assistant",
  mensagem: resposta,
  telefone: numero,
  usuario_id: usuario.id,
  acao_json: acao
})

/* ================= RESPOSTA ================= */

return res.json({
  resposta,
  acao
})

}catch(e){

console.error("ERRO:", e)

return res.status(500).json({
  erro: "erro interno"
})

}
}
