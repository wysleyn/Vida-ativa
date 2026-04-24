const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;

const PLANS = {
  bronze: {
    link: "https://app.syncpayments.com.br/payment-link/a19d5914-077b-4ca2-9363-aa23cd77304c",
    groupId: "-1003806027540"
  },
  silver: {
    link: "https://app.syncpayments.com.br/payment-link/a19d5a4a-5c88-478b-b4a7-d123f61c6d9e",
    groupId: "-1003847434517"
  },
  gold: {
    link: "https://app.syncpayments.com.br/payment-link/a19d5a88-6fd0-4f1e-87b4-89ab591e7c66",
    groupId: "-1003937048123"
  },
  vitalicio: {
    link: "https://app.syncpayments.com.br/payment-link/a19d5ac6-bd85-4967-bbba-cd4a025dda7a",
    groupId: "-1003938274858"
  }
};

const pendingUsers = {};

// ================= TELEGRAM =================
app.post("/telegram", async (req, res) => {
  try {
    const body = req.body;

    if (body.message) {
      const message = body.message;

      if (message.chat.type !== "private") return res.sendStatus(200);
      if (message.text !== "/start") return res.sendStatus(200);

      const chatId = message.chat.id;

      // ✅ 1️⃣ PRÉVIAS
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

      await axios.post(`${TELEGRAM_API}/sendVideo`, {
        chat_id: chatId,
        video: "BAACAgEAAxkBAAMRaeeqn9Bdg5TLp7bA2KCu_-sX6E8AAi8IAAJioDhHoUy3V8Eymv07BA"
      });

      // ✅ 2️⃣ TEXTO DE VENDAS
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: `Shhh... 🤐 Você acaba de invadir a minha intimidade... 😈

Eu sei exatamente o que você veio buscar aqui, e eu não vou te decepcionar. Se você quer ter acesso ao meu conteúdo mais exclusivo, sem censura e sem frescura, a hora é agora! 🔞🔥

Preparei 4 formas de você entrar no meu mundo VIP.

👇 Clique no botão abaixo para gerar seu PIX agora:`
      });

      // ✅ 3️⃣ BOTÕES COM PLANOS
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: "Escolha seu plano:",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🥉 Bronze - R$9,99", callback_data: "bronze" }],
            [{ text: "🥈 Silver - R$17,90", callback_data: "silver" }],
            [{ text: "🥇 Gold - R$22,90", callback_data: "gold" }],
            [{ text: "💎 Vitalício - R$30,00", callback_data: "vitalicio" }]
          ]
        }
      });

      return res.sendStatus(200);
    }

    // ✅ 4️⃣ CLIQUE NO BOTÃO → ENVIA LINK
    if (body.callback_query) {
      const callback = body.callback_query;
      const plan = callback.data;
      const chatId = callback.message.chat.id;

      if (PLANS[plan]) {
        pendingUsers[chatId] = plan;

        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: `✅ Clique abaixo para pagar via PIX:\n${PLANS[plan].link}`
        });
      }

      return res.sendStatus(200);
    }

    return res.sendStatus(200);

  } catch (err) {
    console.error(err);
    return res.sendStatus(200);
  }
});

// ✅ 5️⃣ PAGAMENTO CONFIRMADO → ENVIA LINK DO GRUPO
app.post("/syncpay", async (req, res) => {
  try {
    const payload = req.body;

    if (payload.data?.status !== "completed") {
      return res.sendStatus(200);
    }

    const users = Object.keys(pendingUsers);
    if (users.length === 0) return res.sendStatus(200);

    const chatId = users[users.length - 1];
    const plan = pendingUsers[chatId];
    const groupId = PLANS[plan].groupId;

    const invite = await axios.post(`${TELEGRAM_API}/createChatInviteLink`, {
      chat_id: groupId,
      member_limit: 1
    });

    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: `🎉 Pagamento aprovado!

Clique para entrar no grupo:
${invite.data.result.invite_link}`
    });

    delete pendingUsers[chatId];

    return res.sendStatus(200);

  } catch (err) {
    console.error(err);
    return res.sendStatus(200);
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Bot rodando...");
});
