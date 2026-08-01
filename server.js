import express from "express";
import Anthropic from "@anthropic-ai/sdk";

const app = express();
app.use(express.json());

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Eres Brisa, la asistente virtual de WhatsApp de un negocio.
Responde en mensajes cortos (1 a 3 lineas), recomienda en vez de listar todo,
confirma antes de cobrar, y si no sabes algo ofrece conectar con una persona.`;

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];
        if (mode === "subscribe" && token === VERIFY_TOKEN) {
            res.status(200).send(challenge);
              } else {
                  res.sendStatus(403);
                    }
                    });

                    app.post("/webhook", async (req, res) => {
                      res.sendStatus(200);

                        const entry = req.body.entry?.[0];
                          const message = entry?.changes?.[0]?.value?.messages?.[0];
                            if (!message) return;

                              const from = message.from;
                                const text = message.text?.body || "";

                                  const reply = await anthropic.messages.create({
                                      model: "claude-sonnet-4-5",
                                          max_tokens: 300,
                                              system: SYSTEM_PROMPT,
                                                  messages: [{ role: "user", content: text }],
                                                    });

                                                      const replyText = reply.content[0].text;

                                                        await fetch(`https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`, {
                                                            method: "POST",
                                                                headers: {
                                                                      "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
                                                                            "Content-Type": "application/json",
                                                                                },
                                                                                    body: JSON.stringify({
                                                                                          messaging_product: "whatsapp",
                                                                                                to: from,
                                                                                                      type: "text",
                                                                                                            text: { body: replyText },
                                                                                                                }),
                                                                                                                  });
                                                                                                                  });
                                                                                                                  
                                                                                                                  app.listen(process.env.PORT || 3000, () => console.log("Brisa activa"));
                                                                                                                  
