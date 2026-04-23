require("dotenv").config()

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args))

const { createClient } = require("@supabase/supabase-js")

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
)

module.exports = async function(req, res){

  try{

    const { template = "aniversario_mercatto" } = req.body

    console.log("🚀 DISPARO EM MASSA INICIADO")
    console.log("📦 TEMPLATE:", template)

    /* ================= BUSCAR CLIENTES ================= */

    const { data: clientes, error } = await supabase
      .from("memoria_clientes")
      .select("telefone,nome")

    if(error){
      console.log("❌ ERRO AO BUSCAR CLIENTES:", error)
      return res.status(500).json({ error })
    }

    if(!clientes || !clientes.length){
      return res.json({
        ok:true,
        total:0,
        enviados:0
      })
    }

    console.log(`👥 TOTAL DE CLIENTES: ${clientes.length}`)

    let enviados = 0
    let erros = 0

    const resultados = []

    /* ================= LOOP ================= */

    for(const cliente of clientes){

      const telefone = cliente.telefone
      const nome = cliente.nome || "Cliente"

      console.log("📤 ENVIANDO PARA:", telefone)

      try{

        const resp = await fetch(`${process.env.API_URL}/api/send-template`,{
          method:"POST",
          headers:{
            "Content-Type":"application/json"
          },
          body: JSON.stringify({
            telefone,
            template,
            parametros:{
              nome
            }
          })
        })

        const data = await resp.json()

        if(data.error){
          throw new Error(JSON.stringify(data.error))
        }

        enviados++

        resultados.push({
          telefone,
          status:"ok"
        })

        console.log(`✅ ENVIADO: ${telefone}`)

      }catch(err){

        erros++

        resultados.push({
          telefone,
          status:"erro",
          erro: err.message
        })

        console.log(`❌ ERRO: ${telefone}`, err.message)
      }

      /* ⏱️ DELAY ANTI BLOQUEIO META */
      await new Promise(r => setTimeout(r, 1200))
    }

    console.log("📊 FINALIZADO")
    console.log("✅ ENVIADOS:", enviados)
    console.log("❌ ERROS:", erros)

    return res.json({
      ok:true,
      total: clientes.length,
      enviados,
      erros,
      resultados
    })

  }catch(err){

    console.log("🔥 ERRO GERAL:", err)

    return res.status(500).json({
      error: err.message
    })
  }

}
