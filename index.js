const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const SIGILO_PUBLIC_KEY = process.env.SIGILO_PUBLIC_KEY;
const SIGILO_SECRET_KEY = process.env.SIGILO_SECRET_KEY;
const SIGILO_API_URL = "https://app.sigilopay.com.br";

const PLANS = {
  bronze: {
    nome: "Bronze",
    valor: 5.90,
    groupId: "-1003806027540"
  },
  silver: {
    nome: "Silver",
    valor: 9.90,
    groupId: "-1003847434517"
  },
  gold: {
    nome: "Gold",
    valor: 14.90,
    groupId: "-1003937048123"
  },
  vitalicio: {
    nome: "Vitalício",
    valor: 20.00,
    groupId: "-1003938274858"
  }
};

const pendingUsers = {};

// ================= GERAR PIX SIGILO PAY =================
async function gerarPix(chatId, plan) {
  try {
    const plano = PLANS[plan];

    const response = await axios.post(
      `${SIGILO_API_URL}/api/transactions`,
      {
        amount: plano.valor,
        description: `Plano ${plano.nome}`,
        external_id: `${chatId}_${Date.now()}`,
        customer: {
          name: "Cliente Telegram",
          email: `user_${chatId}@cliente.com`,
          phone: "11999999999",
          document: "000.000.000-00"
        },
        payment_method: "pix"
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-public-key": SIGILO_PUBLIC_KEY,
          "x-secret-key": SIGILO_SECRET_KEY
        }
      }
    );

    console.log("Resposta Sigilo Pay:", JSON.stringify(response.data));
    return response.data;

  } catch (err) {
    console.error("Erro ao gerar PIX:", err.response?.data || err.message);
    return null;
  }
}

// ================= TELEGRAM =================
app.post("/telegram", async (req, res) => {
  try {
    const body = req.body;

    if (body.message) {
      const message = body.message;

      if (message.chat.type !== "private") return res.sendStatus(200);
      if (message.text !== "/start") return res.sendStatus(200);

      const chatId = message.chat.id;

      // PRÉVIAS
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

      // TEXTO DE VENDAS
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: `Shhh... 🤐 Você acaba de invadir a minha intimidade... 😈

Eu sei exatamente o que você veio buscar aqui, e eu não vou te decepcionar. Se você quer ter acesso ao meu conteúdo mais exclusivo, sem censura e sem frescura, a hora é agora! 🔞🔥

Preparei 4 formas de você entrar no meu mundo VIP.

👇 Clique no botão abaixo para gerar seu PIX agora:`
      });

      // BOTÕES COM PLANOS
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

    // CLIQUE NO BOTÃO → GERA PIX
    if (body.callback_query) {
      const callback = body.callback_query;
      const plan = callback.data;
      const chatId = callback.message.chat.id;

      if (PLANS[plan]) {
        await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, {
          callback_query_id: callback.id,
          text: "Gerando seu PIX... Aguarde!"
        });

        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: "⏳ Gerando seu PIX... Aguarde alguns segundos."
        });

        const pixData = await gerarPix(chatId, plan);

        if (pixData) {
          // Salvar o ID da transação para confirmar o pagamento depois
          const transactionId = pixData?.data?.id || pixData?.id;
          const pixCode = pixData?.data?.pix?.qr_code || 
                         pixData?.data?.pix_code ||
                         pixData?.data?.payload ||
                         pixData?.pix?.qr_code ||
                         pixData?.payload;

          console.log("Transaction ID:", transactionId);
          console.log("PIX Code:", pixCode);

          if (pixCode) {
            pendingUsers[transactionId] = { chatId, plan };

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
        } else {
          await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text: "❌ Erro ao gerar PIX. Tente novamente."
          });
        }
      }

      return res.sendStatus(200);
    }

    return res.sendStatus(200);

  } catch (err) {
    console.error(err);
    return res.sendStatus(200);
  }
});

// ================= WEBHOOK SIGILO PAY =================
app.post("/sigilopay", async (req, res) => {
  try {
    const payload = req.body;
    console.log("Webhook Sigilo Pay recebido:", JSON.stringify(payload));

    const status = payload?.data?.status || payload?.status;
    const transactionId = payload?.data?.id || payload?.id;

    if (status !== "paid" && status !== "completed") {
      return res.sendStatus(200);
    }

    const userData = pendingUsers[transactionId];
    if (!userData) {
      console.log("Usuário não encontrado para transação:", transactionId);
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
      text: `🎉 *Pagamento aprovado!*\n\nSeu acesso foi liberado! Clique abaixo para entrar:\n${invite.data.result.invite_link}`,
      parse_mode: "Markdown"
    });

    delete pendingUsers[transactionId];

    return res.sendStatus(200);

  } catch (err) {
    console.error("Erro no webhook:", err);
    return res.sendStatus(200);
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Bot rodando...");
});
