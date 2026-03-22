import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
)

export default async function handler(req, res){

  try{
    const { action } = req.body

    // ===============================
    // LISTAR EMPRESAS + USUARIOS
    // ===============================
    if(action === "listar"){

      const { data: empresas } = await supabase
        .from("empresas")
        .select("*")
        .order("nome", { ascending: true })

      const { data: usuarios } = await supabase
        .from("usuarios")
        .select("*")

      return res.json({ empresas, usuarios })
    }

    // ===============================
    // CRIAR USUARIO
    // ===============================
    if(action === "criar"){

      const { email, senha, nome, empresa_id, perfil } = req.body

      // cria no auth
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true
      })

      if(error) throw error

      // vincula
      await supabase
        .from("usuarios")
        .update({
          nome,
          empresa_id,
          perfil
        })
        .eq("auth_id", data.user.id)

      return res.json({ ok:true })
    }

    // ===============================
    // EXCLUIR USUARIO
    // ===============================
    if(action === "excluir"){

      const { auth_id } = req.body

      // remove do auth
      await supabase.auth.admin.deleteUser(auth_id)

      // remove do banco
      await supabase
        .from("usuarios")
        .delete()
        .eq("auth_id", auth_id)

      return res.json({ ok:true })
    }

    res.status(400).json({ error:"Ação inválida" })

  }catch(err){
    res.status(500).json({ error: err.message })
  }
}
