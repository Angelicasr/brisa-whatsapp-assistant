import express from "express";

const app = express();
app.use(express.json());

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `Eres Brisa, la asistente virtual de WhatsApp de un negocio. Responde en mensajes cortos (1 a 3 lineas), recomienda en vez de listar todo, confirma antes de cobrar, y si no sabes algo ofrece conectar con una persona.`;

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
  try {
    const entry = req.body.entry?.[0];
    const message = entry?.changes?.[0]?.value?.messages?.[0];
    if (!message) return;

  const from = message.from;
    const text = message.text?.body || "";

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: text }],
    }),
  });

  const anthropicData = await anthropicRes.json();
    console.log("Anthropic response:", JSON.stringify(anthropicData));

  const replyText = anthropicData.content?.[0]?.text || "Disculpa, tuve un problema para responder. Un miembro del equipo te contactara pronto.";

  const waRes = await fetch(`https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`, {
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

  const waData = await waRes.json();
    console.log("WhatsApp send response:", JSON.stringify(waData));
  } catch (err) {
    console.error("Error procesando webhook:", err);
  }
});

app.listen(process.env.PORT || 3000, () => console.log("Brisa activa"));
