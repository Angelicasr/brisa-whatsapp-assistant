import express from "express";
 
const app = express();
app.use(express.json());
 
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
 
const SYSTEM_PROMPT = `Eres Brisa, la asistente virtual de WhatsApp de un negocio. Responde en mensajes cortos (1 a 3 lineas), recomienda en vez de listar todo, confirma antes de cobrar, y si no sabes algo ofrece conectar con una persona.`;
 
// ---- NUEVO: memoria de conversación ----
// Guarda el historial de cada cliente, usando su número de WhatsApp como clave.
// OJO: esto vive en la memoria del servidor. Si el servidor se reinicia, se borra.
// Más adelante se puede pasar a una base de datos para que sea permanente.
const historiales = {};
 
function obtenerHistorial(numero) {
  if (!historiales[numero]) {
    historiales[numero] = [];
  }
  return historiales[numero];
}
 
function agregarAlHistorial(numero, role, texto) {
  const historial = obtenerHistorial(numero);
  historial.push({ role, parts: [{ text: texto }] });
 
  // Límite de mensajes guardados para no gastar de más al llamar a Gemini
  if (historial.length > 20) {
    historiales[numero] = historial.slice(-20);
  }
}
// ---- FIN NUEVO ----
 
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
 
    // NUEVO: agrega el mensaje del cliente al historial antes de llamar a Gemini
    agregarAlHistorial(from, "user", text);
 
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          // NUEVO: en vez de mandar solo el mensaje actual, manda todo el historial
          contents: obtenerHistorial(from),
        }),
      }
    );
 
    const geminiData = await geminiRes.json();
    console.log("Gemini response:", JSON.stringify(geminiData));
 
    const replyText =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Disculpa, tuve un problema para responder. Un miembro del equipo te contactara pronto.";
 
    // NUEVO: guarda también la respuesta de Brisa en el historial
    agregarAlHistorial(from, "model", replyText);
 
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
