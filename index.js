const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;

app.post("/telegram", async (req, res) => {
  try {

    // ===== MENSAGEM =====
    if (req.body.message) {
      const message = req.body.message;

      // ✅ Só privado
      if (message.chat.type !== "private") return res.sendStatus(200);

      // ✅ Só responde ao /start
      if (message.text !== "/start") return res.sendStatus(200);

      const chatId = message.chat.id;

      // Fotos
      await axios.post(`${TELEGRAM_API}/sendPhoto`, {
        chat_id: chatId,
        photo: "AgACAgEAAxkBAAMmaefX9d5_BnGOsZNe5jajEjs5mM0AAisMaxsv-DhH6hrvYqGw0ZsBAAMCAAN5AAM7BA"
      });

      await axios.post(`${TELEGRAM_API}/sendPhoto`, {
        chat_id: chatId,
        photo: "AgACAgEAAxkBAAMOaeeqn3T1AZSGEfeM1aeVemRpv38AAgoMaxtioDhHr6tDUDO92ZIBAAMCAAN5AAM7BA"
      });

      await axios.post(`${TELEGRAM_API}/sendPhoto`, {
        chat_id: chatId,
        photo: "AgACAgEAAxkBAAMoaefYGe3b4S1tZgkWEs20W9jYBKoAAiwMaxsv-DhHMSF_vk9wDigBAAMCAAN5AAM7BA"
      });

      // Vídeo
      await axios.post(`${TELEGRAM_API}/sendVideo`, {
        chat_id: chatId,
        video: "BAACAgEAAxkBAAMRaeeqn9Bdg5TLp7bA2KCu_-sX6E8AAi8IAAJioDhHoUy3V8Eymv07BA"
      });

      // Texto
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: `Shhh... 🤐 Você acaba de invadir a minha intimidade... 😈

Eu sei exatamente o que você veio buscar aqui...

👇 Clique no botão abaixo para gerar seu PIX agora:`
      });

      // Botões
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: "Escolha seu plano:",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🥉 Bronze - R$9,99", url: "https://app.syncpayments.com.br/payment-link/a19d5914-077b-4ca2-9363-aa23cd77304c" }],
            [{ text: "🥈 Silver - R$17,90", url: "https://app.syncpayments.com.br/payment-link/a19d5a4a-5c88-478b-b4a7-d123f61c6d9e" }],
            [{ text: "🥇 Gold - R$22,90", url: "https://app.syncpayments.com.br/payment-link/a19d5a88-6fd0-4f1e-87b4-89ab591e7c66" }],
            [{ text: "💎 Vitalício - R$30,00", url: "https://app.syncpayments.com.br/payment-link/a19d5ac6-bd85-4967-bbba-cd4a025dda7a" }]
          ]
        }
      });

      return res.sendStatus(200);
    }

    // ✅ Ignora tudo que não seja /start
    return res.sendStatus(200);

  } catch (err) {
    console.error(err.response?.data || err.message);
    return res.sendStatus(200);
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Bot rodando...");
});
