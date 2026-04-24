const OpenAI = require("openai")
const { createClient } = require("@supabase/supabase-js")

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
)

/* ================= SALVAR CONVERSA ================= */

async function salvarMensagem({ telefone, mensagem, role }){

  await supabase.from("conversas_whatsapp").insert({
    telefone,
    mensagem,
    role,
    tipo: "texto"
  })

}

/* ================= BUSCAR HISTORICO ================= */

async function buscarHistorico(telefone){

  const { data } = await supabase
    .from("conversas_whatsapp")
    .select("mensagem, role")
    .eq("telefone", telefone)
    .order("created_at", { ascending: true })
    .limit(20)

  return data || []
}

/* ================= CRUD MUSICOS ================= */

async function listarMusicos(){
  const { data } = await supabase
    .from("agenda_musicos")
    .select("*")
    .order("data", { ascending: true })

  return data
}

async function inserirMusico(dados){
  return await supabase.from("agenda_musicos").insert(dados)
}

async function atualizarMusico(id, dados){
  return await supabase
    .from("agenda_musicos")
    .update(dados)
    .eq("id", id)
}

async function deletarMusico(id){
  return await supabase
    .from("agenda_musicos")
    .delete()
    .eq("id", id)
}

/* ================= HANDLER ================= */

module.exports = async function handler(req, res){

  try{

    const { pergunta, numero, usuario } = req.body

    const nivel = usuario?.nivel_acesso || 0

    /* ================= SALVA PERGUNTA ================= */

    await salvarMensagem({
      telefone: numero,
      mensagem: pergunta,
      role: "user"
    })

    /* ================= HISTORICO ================= */

    const historico = await buscarHistorico(numero)

    const contexto = historico.map(m => ({
      role: m.role,
      content: m.mensagem
    }))

    /* ================= PROMPT ================= */

    const systemPrompt = `
Você é um agente GERENTE do sistema Mercatto.

Você pode:

- Ver agenda de músicos
- Inserir músicos
- Atualizar músicos
- Deletar músicos

Tabela:
agenda_musicos:
- id
- empresa
- data
- cantor
- hora
- valor
- estilo
- foto

REGRAS:

- Só execute ações se o usuário pedir claramente
- Sempre confirme antes de deletar
- Se o usuário mandar imagem, pergunte:
  "Deseja usar essa imagem como poster do músico?"

- Nunca invente dados
- Sempre responda claro e direto
`

    /* ================= IA ================= */

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...contexto,
        { role: "user", content: pergunta }
      ]
    })

    let resposta = completion.choices[0].message.content

    /* ================= AÇÕES ================= */

    const texto = pergunta.toLowerCase()

    if(texto.includes("listar") || texto.includes("agenda")){

      const dados = await listarMusicos()

      resposta = `📅 Agenda:\n\n` + dados.map(m =>
        `${m.data} - ${m.cantor} (${m.hora})`
      ).join("\n")

    }

    if(texto.includes("inserir") && nivel >= 1){

      await inserirMusico({
        empresa: usuario.empresa,
        cantor: "Novo cantor",
        data: new Date(),
        hora: "20:00",
        valor: 0,
        estilo: "Não definido"
      })

      resposta = "✅ Músico inserido com sucesso"
    }

    if(texto.includes("deletar") && nivel >= 1){

      resposta = "⚠️ Confirme o ID do músico para deletar."
    }

    /* ================= SALVA RESPOSTA ================= */

    await salvarMensagem({
      telefone: numero,
      mensagem: resposta,
      role: "assistant"
    })

    return res.json({ resposta })

  }catch(e){

    console.error("❌ ERRO GERENTE:", e)

    return res.json({
      resposta: "Erro interno no agente gerente"
    })
  }
}
