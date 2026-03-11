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

      const message =
        body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

      if (!message) {
        return res.status(200).json({ ok: true });
      }

      const from = message.from;
      const text = message.text?.body;

      console.log("Cliente:", from);
      console.log("Mensagem:", text);

      // =============================
      // OPENAI
      // =============================

      const ai = await fetch("https://api.openai.com/v1/chat/completions",{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          Authorization:`Bearer ${process.env.OPENAI_API_KEY}`
        },
        body:JSON.stringify({
          model:"gpt-4.1-mini",
          messages:[
            {
              role:"system",
              content:`Você é atendente do restaurante Mercatto Delícia.

Ajude clientes com:
reservas
aniversários
horários
informações do restaurante.

Responda de forma curta e educada.`
            },
            {
              role:"user",
              content:text
            }
          ]
        })
      });

      const data = await ai.json();

      const reply = data.choices[0].message.content;

      const phoneId =
        body.entry[0].changes[0].value.metadata.phone_number_id;

      // =============================
      // ENVIAR WHATSAPP
      // =============================

      await fetch(
        `https://graph.facebook.com/v19.0/${phoneId}/messages`,
        {
          method:"POST",
          headers:{
            Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`,
            "Content-Type":"application/json"
          },
          body:JSON.stringify({
            messaging_product:"whatsapp",
            to:from,
            type:"text",
            text:{ body:reply }
          })
        }
      );

      return res.status(200).json({ ok:true });

    }

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      erro:error.message
    });

  }

}
