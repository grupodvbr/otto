import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

export default async function handler(req, res) {

  // 🚫 DESABILITA CACHE
  res.setHeader("Cache-Control", "no-store");

  const { numero } = req.query;

  try {

    if (!numero) {

      const { data, error } = await supabase
        .from("conversas_whatsapp")
        .select("telefone, created_at")
        .order("created_at", { ascending: false });

      if(error) throw error;

      const unicos = [...new Set(data.map(d => d.telefone))];

      return res.status(200).json(unicos);
    }

    const { data, error } = await supabase
      .from("conversas_whatsapp")
      .select("*")
      .eq("telefone", numero)
      .order("created_at", { ascending: true });

    if(error) throw error;

    return res.status(200).json(data);

  } catch (e) {
    console.log("ERRO API CONVERSAS:", e);
    return res.status(500).json({ error: e.message });
  }
}
