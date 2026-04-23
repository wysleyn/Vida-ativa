const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;

app.post("/telegram", async (req, res) => {
  const message = req.body.message;
  if (!message) return res.sendStatus(200);

  const chatId = message.chat.id;

  try {
    // Foto 1
    await axios.post(`${TELEGRAM_API}/sendPhoto`, {
      chat_id: chatId,
      photo: "AgACAgEAAxkBAAMmaefX9d5_BnGOsZNe5jajEjs5mM0AAisMaxsv-DhH6hrvYqGw0ZsBAAMCAAN5AAM7BA"
    });

    // Foto 2
    await axios.post(`${TELEGRAM_API}/sendPhoto`, {
      chat_id: chatId,
      photo: "AgACAgEAAxkBAAMOaeeqn3T1AZSGEfeM1aeVemRpv38AAgoMaxtioDhHr6tDUDO92ZIBAAMCAAN5AAM7BA"
    });

    // Foto 3
    await axios.post(`${TELEGRAM_API}/sendPhoto`, {
      chat_id: chatId,
      photo: "AgACAgEAAxkBAAMoaefYGe3b4S1tZgkWEs20W9jYBKoAAiwMaxsv-DhHMSF_vk9wDigBAAMCAAN5AAM7BA"
    });

    // Vídeo
    await axios.post(`${TELEGRAM_API}/sendVideo`, {
      chat_id: chatId,
      video: "BAACAgEAAxkBAAMRaeeqn9Bdg5TLp7bA2KCu_-sX6E8AAi8IAAJioDhHoUy3V8Eymv07BA"
    });

    // Texto de venda
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: `Shhh... 🤐 Você acaba de invadir a minha intimidade... 😈

Eu sei exatamente o que você veio buscar aqui, e eu não vou te decepcionar. Se você quer ter acesso ao meu conteúdo mais exclusivo, sem censura e sem frescura, a hora é agora! 🔞🔥

Preparei 4 formas de você entrar no meu mundo VIP. Escolha a que mais combina com o seu desejo e receba o acesso IMEDIATO via PIX:

💎 ESCOLHA SEU PLANO:
🥉 PLANO BRONZE
Acesso por 30 dias ao grupo principal. Ideal para quem quer apenas dar uma espiadinha.

🥈 PLANO SILVER
90 dias de acesso + Bônus de fotos inéditas. Para quem quer mais tempo de prazer.

🥇 PLANO GOLD
Acesso Semestral + Conteúdo Premium (Vídeos Longos). Para os meus favoritos.

💎 ACESSO VITALÍCIO
Pague uma vez e seja meu convidado para SEMPRE. Todos os grupos, todos os vídeos, sem mensalidade.

👇 Clique no botão abaixo para gerar seu PIX agora:`
    });

    // Botões com links
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: "Escolha seu plano:",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🥉 Bronze", url: "https://app.syncpayments.com.br/payment-link/a19d5914-077b-4ca2-9363-aa23cd77304c" }],
          [{ text: "🥈 Silver", url: "https://app.syncpayments.com.br/payment-link/a19d5a4a-5c88-478b-b4a7-d123f61c6d9e" }],
          [{ text: "🥇 Gold", url: "https://app.syncpayments.com.br/payment-link/a19d5a88-6fd0-4f1e-87b4-89ab591e7c66" }],
          [{ text: "💎 Vitalício", url: "https://app.syncpayments.com.br/payment-link/a19d5ac6-bd85-4967-bbba-cd4a025dda7a" }]
        ]
      }
    });

  } catch (error) {
    console.error(error.response?.data || error.message);
  }

  res.sendStatus(200);
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Bot rodando...");
});
