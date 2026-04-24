const OpenAI = require("openai")
const { createClient } = require("@supabase/supabase-js")

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
)

module.exports = async function handler(req, res){

  try{

    const { pergunta, usuario } = req.body

    const empresa = usuario.empresa
    const numero = req.body.numero

    console.log("📩 PERGUNTA:", pergunta)
    console.log("🏢 EMPRESA:", empresa)

    /* ================= DATA ================= */

    const hoje = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Bahia"
    })

    console.log("📅 HOJE:", hoje)

    /* ================= BUSCA BASE ================= */

    const { data: base } = await supabase
      .from("agenda_musicos")
      .select("*")
      .eq("empresa", empresa)

    console.log("📊 TOTAL:", base?.length)

    /* ================= TOOLS ================= */

    const tools = [

      {
        type: "function",
        function: {
          name: "listar_musicos",
          description: "Lista músicos por data ou todos",
          parameters: {
            type: "object",
            properties: {
              data: { type: "string" }
            }
          }
        }
      },

      {
        type: "function",
        function: {
          name: "deletar_musico",
          description: "Remove músico por id",
          parameters: {
            type: "object",
            properties: {
              id: { type: "string" }
            },
            required: ["id"]
          }
        }
      },

      {
        type: "function",
        function: {
          name: "inserir_musico",
          description: "Cria novo músico",
          parameters: {
            type: "object",
            properties: {
              cantor: { type: "string" },
              data: { type: "string" },
              hora: { type: "string" }
            },
            required: ["cantor", "data", "hora"]
          }
        }
      }

    ]

    /* ================= IA ================= */

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `
Você é o gerente inteligente da empresa ${empresa}.

Data atual: ${hoje}

DADOS REAIS:
${JSON.stringify(base?.slice(0, 50), null, 2)}

REGRAS:

- Nunca invente dados
- Sempre usar os dados acima
- Se usuário disser "hoje" → usar ${hoje}
- Se disser "agenda" → listar tudo
- Se disser "deletar" → escolher registro correto
- Se disser "oi" ou algo vago → mostrar músicos de hoje
- Nunca perguntar coisas óbvias

Você decide e usa as funções quando necessário.
`
        },
        { role: "user", content: pergunta }
      ],
      tools,
      tool_choice: "auto"
    })

    const msg = completion.choices[0].message

    console.log("🧠 IA DECISÃO:", msg)

    /* ================= EXECUÇÃO ================= */

    if(msg.tool_calls){

      const call = msg.tool_calls[0]
      const name = call.function.name
      const args = JSON.parse(call.function.arguments || "{}")

      console.log("⚙️ TOOL:", name)
      console.log("📥 ARGS:", args)

      /* ===== LISTAR ===== */

      if(name === "listar_musicos"){

        const dataFiltro = args.data || hoje

        const lista = base.filter(m => m.data === dataFiltro)

        if(lista.length === 0){
          return res.json({ resposta: "📭 Nenhum músico." })
        }

        const resposta = lista.map(m =>
          `🎤 ${m.cantor.trim()} - ${m.hora}`
        ).join("\n")

        return res.json({
          resposta: `📅 Agenda:\n\n${resposta}`
        })
      }

      /* ===== DELETE ===== */

      if(name === "deletar_musico"){

        await supabase
          .from("agenda_musicos")
          .delete()
          .eq("id", args.id)

        return res.json({
          resposta: "🗑️ Removido com sucesso."
        })
      }

      /* ===== INSERT ===== */

      if(name === "inserir_musico"){

        await supabase.from("agenda_musicos").insert({
          empresa,
          cantor: args.cantor,
          data: args.data,
          hora: args.hora,
          valor: 0
        })

        return res.json({
          resposta: "✅ Inserido com sucesso."
        })
      }
    }

    /* ================= FALLBACK ================= */

    let resposta = msg.content

    if(!resposta || resposta.trim().length < 2){

      const hojeLista = base.filter(m => m.data === hoje)

      const lista = hojeLista.map(m =>
        `🎤 ${m.cantor.trim()} - ${m.hora}`
      ).join("\n")

      resposta = `📅 Músicos de hoje:\n\n${lista}`
    }

    return res.json({ resposta })

  }catch(e){

    console.error("❌ ERRO:", e)

    return res.json({
      resposta: "Erro interno no sistema"
    })
  }
}
