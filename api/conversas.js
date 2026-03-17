import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

export default async function handler(req, res) {

  const { numero } = req.query;

  try {

    if (!numero) {
      // lista de clientes
      const { data } = await supabase
        .from("conversas_whatsapp")
        .select("telefone")
        .order("created_at", { ascending: false });

      const unicos = [...new Set(data.map(d => d.telefone))];

      return res.json(unicos);
    }

    // mensagens de um cliente
    const { data } = await supabase
      .from("conversas_whatsapp")
      .select("*")
      .eq("telefone", numero)
      .order("created_at", { ascending: true });

    return res.json(data);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
