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

let LOG = {
  telefone: null,
  pergunta: null,
  usuario: null,
  dados: null,
  prompt: null,
  resposta: null,
  acao: null,
  erro: null
}

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

LOG.pergunta = pergunta
LOG.telefone = numero

if(!numero){
  throw new Error("Número não informado")
}

/* ================= USUARIO ================= */

const { data: usuario } = await supabase
  .from("usuarios_do_sistema")
  .select("*")
  .eq("telefone", numero)
  .eq("ativo", true)
  .maybeSingle()

if(!usuario){
  throw new Error("Usuário não autorizado")
}

LOG.usuario = usuario

if(usuario.nivel_acesso !== 0){
  throw new Error("Usuário sem permissão")
}

/* ================= BUSCA TOTAL ================= */

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

  supabase.from("reservas_mercatto").select("*").limit(2000),
  supabase.from("pedidos").select("*").limit(2000),
  supabase.from("memoria_clientes").select("*").limit(2000),
  supabase.from("produtos").select("*").limit(2000),
  supabase.from("buffet_lancamentos").select("*").limit(2000),
  supabase.from("agenda_musicos").select("*").limit(2000),
  supabase.from("usuarios_do_sistema").select("*"),
  supabase.from("prompt_agente").select("*").eq("ativo", true).order("ordem",{ascending:true})

])

const dadosBrutos = {
  reservas: reservas.data || [],
  pedidos: pedidos.data || [],
  clientes: clientes.data || [],
  produtos: produtos.data || [],
  buffet: buffet.data || [],
  musicos: musicos.data || [],
  usuarios: usuariosSistema.data || []
}

LOG.dados = dadosBrutos

/* ================= PROMPT ================= */

const promptFinal = (prompts.data || [])
  .map(p => p.prompt)
  .join("\n\n")

LOG.prompt = promptFinal

/* ================= CONTEXTO INTELIGENTE ================= */

const contextos = [

{
role:"system",
content:`
🔥 MOTOR OTTO — ACESSO TOTAL

Você possui acesso COMPLETO aos dados abaixo.

📊 TABELAS DISPONÍVEIS:

1. RESERVAS → reservas_mercatto
- dados de reservas, clientes, valores, datas

2. PEDIDOS → pedidos
- vendas realizadas

3. CLIENTES → memoria_clientes
- histórico e dados de clientes

4. PRODUTOS → produtos
- cardápio e custos

5. BUFFET → buffet_lancamentos
- produção e consumo

6. MUSICOS → agenda_musicos
- agenda de shows

7. USUARIOS → usuarios_do_sistema
- equipe

━━━━━━━━━━━━━━━━━━━━━━

🎯 SUA FUNÇÃO:

- Entender o que o usuário quer
- Buscar nos dados corretos
- Analisar como executivo
- Nunca inventar

━━━━━━━━━━━━━━━━━━━━━━

🚨 REGRAS:

- Use SOMENTE os dados fornecidos
- Se não houver dados → fazer análise inteligente
- Nunca retornar resposta vazia
- Sempre interpretar cenário

`
},

{
role:"system",
content:`USUARIO:\n${JSON.stringify(usuario)}`
},

{
role:"system",
content:`DADOS:\n${JSON.stringify(dadosBrutos)}`
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
LOG.resposta = resposta

/* ================= AÇÃO ================= */

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
    LOG.acao = acao

  }catch(e){
    LOG.erro = "Erro parse ação"
  }
}

/* ================= SALVAR CHAT ================= */

await supabase.from("assistente_otto_chat").insert({
  role: "user",
  mensagem: pergunta,
  telefone: numero,
  usuario_id: usuario.id
})

await supabase.from("assistente_otto_chat").insert({
  role: "assistant",
  mensagem: resposta,
  telefone: numero,
  usuario_id: usuario.id,
  acao_json: acao
})

/* ================= SALVAR LOG ================= */

await supabase.from("assistente_otto_logs").insert(LOG)

/* ================= RESPOSTA ================= */

return res.json({
  resposta,
  acao
})

}catch(e){

console.error("ERRO:", e)

LOG.erro = e.message

await supabase.from("assistente_otto_logs").insert(LOG)

return res.status(500).json({
  erro: "erro interno"
})

}
}
