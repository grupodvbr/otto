export default async function handler(req, res) {

  try {

    if (req.method === "GET") {

      const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];

      if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
        return res.status(200).send(challenge);
      }

      return res.status(200).send("Webhook Mercatto ativo");
    }

    if (req.method === "POST") {

      const body = req.body;

      console.log("Mensagem recebida:", JSON.stringify(body, null, 2));

      const message =
        body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

      if (message) {

        const from = message.from;
        const text = message.text?.body;

        console.log("Cliente:", from);
        console.log("Mensagem:", text);

        await fetch(
          `https://graph.facebook.com/v19.0/${body.entry[0].changes[0].value.metadata.phone_number_id}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: from,
              type: "text",
              text: {
                body: "Olá 👋 Bem-vindo ao Mercatto Delícia. Como posso ajudar com sua reserva?"
              }
            })
          }
        );

      }

      return res.status(200).json({ received: true });

    }

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      erro: error.message
    });

  }

}
