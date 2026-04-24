const OpenAI = require("openai")
const { createClient } = require("@supabase/supabase-js")

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
)

/* ================= NORMALIZA ================= */

function normalize(str){
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

/* ================= HANDLER ================= */

module.exports = async function handler(req, res){

  try{

    const { pergunta, usuario } = req.body

    const empresa = usuario.empresa

    console.log("📩 PERGUNTA:", pergunta)
    console.log("🏢 EMPRESA:", empresa)

    /* ================= DATA ================= */

    const hoje = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Bahia"
    })

    /* ================= BUSCA BASE ================= */

    const { data: raw, error } = await supabase
      .from("agenda_musicos")
      .select("*")

    if(error){
      console.log("❌ ERRO BANCO:", error)
    }

    const base = (raw || []).filter(m =>
      normalize(m.empresa).includes(normalize(empresa))
    )

    console.log("📊 TOTAL:", base.length)

    /* ================= TOOLS ================= */

    const tools = [

      {
        type: "function",
        function: {
          name: "listar_musicos",
          description: "Lista músicos",
          parameters: { type: "object", properties: {} }
        }
      },

      {
        type: "function",
        function: {
          name: "inserir_musico",
          description: "Inserir músico",
          parameters: {
            type: "object",
            properties: {
              cantor: { type: "string" },
              data: { type: "string" },
              hora: { type: "string" },
              valor: { type: "number" },
              estilo: { type: "string" }
            },
            required: ["cantor","data","hora"]
          }
        }
      },

      {
        type: "function",
        function: {
          name: "atualizar_musico",
          description: "Atualizar músico",
          parameters: {
            type: "object",
            properties: {
              cantor: { type: "string" },
              data: { type: "string" },
              valor: { type: "number" },
              hora: { type: "string" },
              estilo: { type: "string" }
            },
            required: ["cantor"]
          }
        }
      },

      {
        type: "function",
        function: {
          name: "deletar_musico",
          description: "Remover músico",
          parameters: {
            type: "object",
            properties: {
              cantor: { type: "string" },
              data: { type: "string" }
            },
            required: ["cantor"]
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
Você é o GERENTE INTELIGENTE da agenda de músicos da empresa ${empresa}.

DATA ATUAL: ${hoje}

---

BASE DE DADOS (VERDADE ABSOLUTA):
${JSON.stringify(base, null, 2)}

---

REGRAS:

- Você controla tudo
- Nunca invente dados
- Sempre use a base acima
- Pode listar, inserir, atualizar e deletar
- Se faltar informação → peça
- Se estiver completo → execute
- Se houver mais de um músico com mesmo nome → peça a data

---

COMPORTAMENTO:

- Seja direto
- Nada de respostas genéricas
- Nada de enrolação
- Nada de perguntar o que já está claro

---

EXEMPLOS:

Usuário: "musicos de hoje"
→ listar_musicos

Usuário: "adiciona pedro dia 30/04 15:00"
→ inserir_musico

Usuário: "muda valor do pedro para 12"
→ atualizar_musico

Usuário: "remove pedro"
→ deletar_musico

---

OBJETIVO:

Ser rápido, preciso e agir como gerente real.
`
        },
        {
          role: "user",
          content: pergunta
        }
      ],
      tools
    })

    const msg = completion.choices[0].message

    /* ================= EXECUÇÃO ================= */

    if(msg.tool_calls){

      const call = msg.tool_calls[0]
      const nome = call.function.name
      const args = JSON.parse(call.function.arguments)

      console.log("⚙️ TOOL:", nome)
      console.log("📥 ARGS:", args)

      /* ===== LISTAR ===== */

      if(nome === "listar_musicos"){

        if(base.length === 0){
          return res.json({ resposta: "📭 Nenhum músico." })
        }

        const resposta = base
          .sort((a,b) => a.data.localeCompare(b.data))
          .map(m =>
            `${m.data} - 🎤 ${m.cantor.trim()} (${m.hora})`
          ).join("\n")

        return res.json({
          resposta: `📅 Agenda:\n\n${resposta}`
        })
      }

      /* ===== INSERIR ===== */

      if(nome === "inserir_musico"){

        await supabase.from("agenda_musicos").insert({
          empresa,
          ...args
        })

        return res.json({
          resposta: `✅ ${args.cantor} inserido com sucesso.`
        })
      }

      /* ===== ATUALIZAR ===== */

      if(nome === "atualizar_musico"){

        const encontrados = base.filter(m =>
          normalize(m.cantor).includes(normalize(args.cantor))
        )

        if(encontrados.length === 0){
          return res.json({ resposta: "❌ Músico não encontrado." })
        }

        if(encontrados.length > 1 && !args.data){
          return res.json({
            resposta: `⚠️ Mais de um encontrado:\n\n${encontrados.map(m =>
              `${m.cantor} - ${m.data}`
            ).join("\n")}\n\nInforme a data.`
          })
        }

        const alvo = args.data
          ? encontrados.find(m => m.data === args.data)
          : encontrados[0]

        if(!alvo){
          return res.json({ resposta: "❌ Registro não encontrado." })
        }

        await supabase
          .from("agenda_musicos")
          .update(args)
          .eq("id", alvo.id)

        return res.json({
          resposta: `✏️ ${alvo.cantor} atualizado com sucesso.`
        })
      }

      /* ===== DELETAR ===== */

      if(nome === "deletar_musico"){

        const encontrados = base.filter(m =>
          normalize(m.cantor).includes(normalize(args.cantor))
        )

        if(encontrados.length === 0){
          return res.json({ resposta: "❌ Não encontrado." })
        }

        if(encontrados.length > 1 && !args.data){
          return res.json({
            resposta: `⚠️ Mais de um encontrado:\n\n${encontrados.map(m =>
              `${m.cantor} - ${m.data}`
            ).join("\n")}\n\nInforme a data.`
          })
        }

        const alvo = args.data
          ? encontrados.find(m => m.data === args.data)
          : encontrados[0]

        if(!alvo){
          return res.json({ resposta: "❌ Registro não encontrado." })
        }

        await supabase
          .from("agenda_musicos")
          .delete()
          .eq("id", alvo.id)

        return res.json({
          resposta: `🗑️ ${alvo.cantor} removido.`
        })
      }

    }

    /* ================= RESPOSTA NORMAL ================= */

    return res.json({
      resposta: msg.content || "Ok"
    })

  }catch(e){

    console.error("❌ ERRO GERENTE:", e)

    return res.json({
      resposta: "Erro interno no agente gerente"
    })
  }
}
