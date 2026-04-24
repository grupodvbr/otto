const OpenAI = require("openai")
const { createClient } = require("@supabase/supabase-js")

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
)

const TABELA_MEMORIA = "conversas_gerentes_mercatto"

/* ================= MEMORIA ================= */

async function salvarMensagem({ telefone, mensagem, role, usuario, acao = null, dados_acao = null }){

  await supabase.from(TABELA_MEMORIA).insert({
    telefone,
    mensagem,
    role,
    nome_usuario: usuario?.nome,
    empresa: usuario?.empresa,
    acao,
    dados_acao
  })
}

async function buscarHistorico(telefone){
  const { data } = await supabase
    .from(TABELA_MEMORIA)
    .select("*")
    .eq("telefone", telefone)
    .order("created_at", { ascending: false })
    .limit(30)

  return (data || []).reverse()
}

/* ================= MUSICOS ================= */

async function buscarPorNome(empresa, nome){

  const { data } = await supabase
    .from("agenda_musicos")
    .select("*")
    .eq("empresa", empresa)
    .ilike("cantor", `%${nome}%`)

  return data || []
}

async function deletarPorId(id){
  return await supabase
    .from("agenda_musicos")
    .delete()
    .eq("id", id)
}

async function inserirMusico(dados){
  return await supabase.from("agenda_musicos").insert(dados)
}

/* ================= HANDLER ================= */

module.exports = async function handler(req, res){

  try{

    const { pergunta, numero, usuario } = req.body

    const empresa = usuario.empresa
    const nivel = usuario.nivel_acesso

    const texto = pergunta.toLowerCase()

    /* ================= SALVA USER ================= */

    await salvarMensagem({
      telefone: numero,
      mensagem: pergunta,
      role: "user",
      usuario
    })

    /* ================= HISTORICO ================= */

    const historico = await buscarHistorico(numero)

    /* ================= REVERTER ================= */

    if(texto.includes("reverter")){

      const ultimaAcao = historico.reverse().find(m => m.acao === "delete")

      if(!ultimaAcao){
        return res.json({ resposta: "❌ Nenhuma exclusão recente encontrada." })
      }

      const dados = ultimaAcao.dados_acao

      await inserirMusico(dados)

      const resposta = "♻️ Exclusão revertida com sucesso."

      await salvarMensagem({
        telefone: numero,
        mensagem: resposta,
        role: "assistant",
        usuario
      })

      return res.json({ resposta })
    }

    /* ================= DELETAR ================= */

    if(texto.includes("deletar") && nivel >= 1){

      const nomeMatch = pergunta.replace(/deletar/i, "").trim()

      const encontrados = await buscarPorNome(empresa, nomeMatch)

      if(encontrados.length === 0){
        return res.json({ resposta: "❌ Nenhum músico encontrado." })
      }

      if(encontrados.length === 1){

        const musico = encontrados[0]

        await deletarPorId(musico.id)

        await salvarMensagem({
          telefone: numero,
          mensagem: `Excluído ${musico.cantor}`,
          role: "assistant",
          usuario,
          acao: "delete",
          dados_acao: musico
        })

        return res.json({
          resposta: `🗑️ ${musico.cantor} removido com sucesso.`
        })
      }

      /* MULTIPLOS RESULTADOS */

      const lista = encontrados.map(m =>
        `${m.cantor} - ${m.data} (${m.hora})`
      ).join("\n")

      return res.json({
        resposta: `⚠️ Encontrei vários resultados:\n\n${lista}\n\nInforme a data para excluir.`
      })
    }

    /* ================= IA NORMAL ================= */

    const contexto = historico.map(m => ({
      role: m.role,
      content: m.mensagem
    }))

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `Você é gerente da empresa ${empresa}. Responda de forma objetiva.`
        },
        ...contexto,
        { role: "user", content: pergunta }
      ]
    })

    const resposta = completion.choices[0].message.content

    await salvarMensagem({
      telefone: numero,
      mensagem: resposta,
      role: "assistant",
      usuario
    })

    return res.json({ resposta })

  }catch(e){

    console.error("❌ ERRO:", e)

    return res.json({
      resposta: "Erro interno no agente gerente"
    })
  }
}
