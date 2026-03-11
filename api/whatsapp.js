export default async function handler(req, res) {

  try {

    // =============================
    // VERIFICAÇÃO DO WEBHOOK META
    // =============================
    if (req.method === "GET") {

      const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];

      if (mode && token && challenge) {

        if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
          return res.status(200).send(challenge);
        }

        return res.status(403).send("Token inválido");

      }

      // acesso direto no navegador
      return res.status(200).send("Webhook Mercatto ativo");

    }

    // =============================
    // RECEBER MENSAGEM WHATSAPP
    // =============================
    if (req.method === "POST") {

      console.log("Mensagem recebida:", JSON.stringify(req.body, null, 2));

      return res.status(200).json({ received: true });

    }

    return res.status(200).send("OK");

  } catch (error) {

    console.error("Erro webhook:", error);

    return res.status(500).json({
      erro: "Erro interno",
      detalhe: error.message
    });

  }

}
