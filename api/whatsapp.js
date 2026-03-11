export default async function handler(req, res) {

  try {

    // =============================
    // VERIFICAÇÃO DO WEBHOOK META
    // =============================
    if (req.method === "GET") {

      const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];

      if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
        return res.status(200).send(challenge);
      }

      return res.status(403).send("Forbidden");
    }

    // =============================
    // RECEBER MENSAGEM WHATSAPP
    // =============================
    if (req.method === "POST") {

      console.log("Webhook recebido:", JSON.stringify(req.body, null, 2));

      return res.status(200).json({ status: "ok" });

    }

    return res.status(200).send("Mercatto webhook ativo");

  } catch (err) {

    console.error("Erro webhook:", err);

    return res.status(500).json({
      erro: "Erro interno webhook",
      detalhe: err.message
    });

  }

}
