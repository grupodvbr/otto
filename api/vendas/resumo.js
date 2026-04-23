import fetch from "node-fetch"

/* ================= METAS ================= */

const METAS = {
  "MERCATTO EMPORIO": { meta: 650000 },
  "MERCATTO RESTAURANTE": { meta: 850000 },
  "PADARIA DELÍCIA": { meta: 720000 },
  "VILLA GOURMET": { meta: 746600 },
  "DELÍCIA GOURMET": { meta: 545000 }
}

/* ================= NORMALIZA ================= */

function normalizar(txt){
  return txt
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
}

/* ================= DATA BAHIA ================= */

function getHoje(){
  return new Date(
    new Date().toLocaleString("en-US",{ timeZone:"America/Bahia" })
  )
}

/* ================= META PROPORCIONAL ================= */

function calcularMetaProporcional(metaMensal){

  const hoje = getHoje()

  const diaAtual = hoje.getDate()

  const ultimoDia = new Date(
    hoje.getFullYear(),
    hoje.getMonth() + 1,
    0
  ).getDate()

  const metaAteHoje = (metaMensal / ultimoDia) * diaAtual

  return {
    metaMensal,
    metaAteHoje
  }
}

/* ================= HANDLER ================= */

export default async function handler(req, res){

try{

  const { empresa } = req.query

  console.log("📊 CONSULTA:", empresa || "GERAL")

  /* ================= BUSCA APIs ================= */

  const URL_BASE = "https://inspired-still-reflects-closes.trycloudflare.com"

  const [resMes, resDia] = await Promise.all([
    fetch(`${URL_BASE}/resumo-mes`),
    fetch(`${URL_BASE}/resumo-dia`)
  ])

  if(!resMes.ok || !resDia.ok){
    throw new Error("Erro nas APIs externas")
  }

  const dataMes = await resMes.json()
  const dataDia = await resDia.json()

  console.log("📦 MES:", JSON.stringify(dataMes))
  console.log("📦 DIA:", JSON.stringify(dataDia))

  /* ================= VARIÁVEIS ================= */

  let faturamentoMes = 0
  let vendasMes = 0
  let faturamentoHoje = 0
  let vendasHoje = 0

  /* ================= COM EMPRESA ================= */

  if(empresa){

    const empresaMes = (dataMes.empresas || []).find(e =>
      normalizar(e.empresa) === normalizar(empresa)
    )

    const empresaHoje = (dataDia.empresas || []).find(e =>
      normalizar(e.empresa) === normalizar(empresa)
    )

    faturamentoMes = empresaMes?.faturamento_mes || 0
    vendasMes = empresaMes?.vendas_mes || 0

    faturamentoHoje = empresaHoje?.faturamento || 0
    vendasHoje = empresaHoje?.vendas || 0

  }

  /* ================= GERAL ================= */

  else{

    faturamentoMes = (dataMes.empresas || [])
      .reduce((a,e)=>a + (e.faturamento_mes || 0),0)

    vendasMes = (dataMes.empresas || [])
      .reduce((a,e)=>a + (e.vendas_mes || 0),0)

    faturamentoHoje = dataDia.faturamento || 0
    vendasHoje = dataDia.vendas || 0

  }

  /* ================= TOTAL ================= */

  const faturamentoTotal = faturamentoMes + faturamentoHoje
  const vendasTotal = vendasMes + vendasHoje

  const ticket = vendasTotal > 0
    ? faturamentoTotal / vendasTotal
    : 0

  /* ================= META ================= */

  let metaMensal = 0
  let metaAteHoje = 0
  let percentual = 0

  if(empresa && METAS[empresa]){

    metaMensal = METAS[empresa].meta

    const metaCalc = calcularMetaProporcional(metaMensal)

    metaAteHoje = metaCalc.metaAteHoje

    percentual = metaAteHoje > 0
      ? (faturamentoTotal / metaAteHoje) * 100
      : 0
  }

  /* ================= RESPOSTA ================= */

  return res.json({

    empresa: empresa || "GERAL",

    mes: {
      faturamento: faturamentoMes,
      vendas: vendasMes
    },

    hoje: {
      faturamento: faturamentoHoje,
      vendas: vendasHoje
    },

    total: {
      faturamento: faturamentoTotal,
      vendas: vendasTotal,
      ticket_medio: ticket
    },

    meta: {
      mensal: metaMensal,
      ate_hoje: metaAteHoje,
      percentual: percentual
    }

  })

}catch(e){

  console.log("❌ ERRO:", e)

  return res.status(500).json({
    erro: "erro ao buscar vendas"
  })

}

}
