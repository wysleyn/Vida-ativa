const express = require("express");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");

const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const SIGILO_PUBLIC_KEY = process.env.SIGILO_PUBLIC_KEY;
const SIGILO_SECRET_KEY = process.env.SIGILO_SECRET_KEY;
const SIGILO_API_URL = "https://app.sigilopay.com.br";
const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL || "https://bot-telegram-u7jp.onrender.com";
const PENDING_FILE = "/tmp/pending_users.json";

const PLANS = {
  bronze:   { nome: "Bronze",   valor: 5.90,  groupId: "-1003806027540" },
  silver:   { nome: "Silver",   valor: 9.90,  groupId: "-1003847434517" },
  gold:     { nome: "Gold",     valor: 14.90, groupId: "-1003937048123" },
  vitalicio:{ nome: "Vitalício",valor: 20.00, groupId: "-1003938274858" }
};

function loadPending() {
  try {
    if (fs.existsSync(PENDING_FILE)) {
      return JSON.parse(fs.readFileSync(PENDING_FILE, "utf8"));
    }
  } catch(e) {}
  return {};
}

function savePending(data) {
  try {
    fs.writeFileSync(PENDING_FILE, JSON.stringify(data), "utf8");
  } catch(e) {}
}

function generateValidCPF() {
  const randomDigit = () => Math.floor(Math.random() * 10);
  const n = Array.from({ length: 9 }, randomDigit);
  let d1 = n.reduce((total, digit, index) => total + digit * (10 - index), 0);
  d1 = 11 - (d1 % 11);
  if (d1 >= 10) d1 = 0;
  const n2 = [...n, d1];
  let d2 = n2.reduce((total, digit, index) => total + digit * (11 - index), 0);
  d2 = 11 - (d2 % 11);
  if (d2 >= 10) d2 = 0;
  const cpf = [...n2, d2].join('');
  return `${cpf.slice(0,3)}.${cpf.slice(3,6)}.${cpf.slice(6,9)}-${cpf.slice(9,11)}`;
}

async function gerarPix(chatId, plan) {
  try {
    const plano = PLANS[plan];
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);

    const payload = {
      identifier: uuidv4(),
      amount: plano.valor,
      dueDate: dueDate.toISOString().slice(0, 10),
      callbackUrl: `${WEBHOOK_BASE_URL}/sigilopay`,
      client: {
        name: `Cliente ${chatId}`,
        email: `user_${chatId}@cliente.com`,
        phone: "(11) 99999-9999",
        document: generateValidCPF()
      },
      products: [
        {
          id: plan,
          name: `Plano ${plano.nome}`,
          quantity: 1,
          price: plano.valor
        }
      ]
    };

    const response = await axios.post(
      `${SIGILO_API_URL}/api/v1/gateway/pix/receive`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "x-public-key": SIGILO_PUBLIC_KEY,
          "x-secret-key": SIGILO_SECRET_KEY
        },
        timeout: 30000
      }
    );

    console.log("Resposta Sigilo Pay:", JSON.stringify(response.data));
    return response.data;

  } catch (err) {
    console.error("Erro ao gerar PIX:", err.response?.data || err.message);
    return null;
  }
}

app.post("/telegram", async (req, res) => {
  try {
    const body = req.body;

    if (body.message) {
      const message = body.message;
      if (message.chat.type !== "private") return res.sendStatus(200);
      if (message.text !== "/start") return res.sendStatus(200);

      const chatId = message.chat.id;

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
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: `Shhh... 🤐 Você acaba de invadir a minha intimidade... 😈\n\nEu sei exatamente o que você veio buscar aqui, e eu não vou te decepcionar. Se você quer ter acesso ao meu conteúdo mais exclusivo, sem censura e sem frescura, a hora é agora! 🔞🔥\n\nPreparei 4 formas de você entrar no meu mundo VIP.\n\n👇 Clique no botão abaixo para gerar seu PIX agora:`
      });
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: "Escolha seu plano:",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🥉 Bronze - R$5,90", callback_data: "bronze" }],
            [{ text: "🥈 Silver - R$9,90", callback_data: "silver" }],
            [{ text: "🥇 Gold - R$14,90", callback_data: "gold" }],
            [{ text: "💎 Vitalício - R$20,00", callback_data: "vitalicio" }]
          ]
        }
      });

      return res.sendStatus(200);
    }

    if (body.callback_query) {
      const callback = body.callback_query;
      const plan = callback.data;
      const chatId = callback.message.chat.id;

      if (!PLANS[plan]) return res.sendStatus(200);

      await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, {
        callback_query_id: callback.id,
        text: "Gerando seu PIX... Aguarde!"
      });

      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: "⏳ Gerando seu PIX... Aguarde alguns segundos."
      });

      const pixData = await gerarPix(chatId, plan);

      if (pixData && pixData.pix && pixData.pix.code) {
        const pixCode = pixData.pix.code;
        const transactionId = pixData.transactionId;

        const pending = loadPending();
        pending[transactionId] = { chatId, plan };
        savePending(pending);

        console.log(`PIX gerado: ${transactionId} para ${chatId} plano ${plan}`);

        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: `✅ *PIX GERADO COM SUCESSO!*\n\n💰 *Valor:* R$ ${PLANS[plan].valor.toFixed(2)}\n📌 *Plano:* ${PLANS[plan].nome}\n\n👇 *Clique no código abaixo para copiar:*\n\n\`${pixCode}\`\n\n📱 Abra seu banco e use *Pix Copia e Cola*\n\n✅ O acesso será liberado automaticamente após o pagamento!`,
          parse_mode: "Markdown"
        });
      } else {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: "❌ Erro ao gerar PIX. Tente novamente."
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

app.post("/sigilopay", async (req, res) => {
  try {
    const payload = req.body;
    console.log("Webhook Sigilo Pay recebido:", JSON.stringify(payload));

    const event = payload?.event || "";
    const transaction = payload?.transaction || {};
    const transactionId = transaction?.id || payload?.transactionId || null;
    const status = transaction?.status || payload?.status || "";

    const isPaid = event === "TRANSACTION_PAID" ||
                   status === "PAID" ||
                   status === "COMPLETED" ||
                   status === "OK";

    console.log(`Event: ${event} | Status: ${status} | isPaid: ${isPaid} | transactionId: ${transactionId}`);

    if (!isPaid) return res.sendStatus(200);

    const pending = loadPending();
    const userData = pending[transactionId];

    if (!userData) {
      console.log("Usuário não encontrado para transactionId:", transactionId);
      return res.sendStatus(200);
    }

    const { chatId, plan } = userData;
    const groupId = PLANS[plan].groupId;

    const invite = await axios.post(`${TELEGRAM_API}/createChatInviteLink`, {
      chat_id: groupId,
      member_limit: 1
    });

    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: `🎉 *Pagamento aprovado!*\n\nSeu acesso foi liberado! Clique abaixo para entrar no grupo VIP:\n${invite.data.result.invite_link}`,
      parse_mode: "Markdown"
    });

    delete pending[transactionId];
    savePending(pending);

    console.log(`Acesso liberado para ${chatId} plano ${plan}`);
    return res.sendStatus(200);

  } catch (err) {
    console.error("Erro webhook:", err);
    return res.sendStatus(200);
  }
});

app.get('/sigilopay', (req, res) => res.sendStatus(200));

app.listen(process.env.PORT || 3000, () => {
  console.log("Bot rodando...");
});



