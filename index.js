const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// 🔐 Variáveis de ambiente
const TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const ACCOUNT_ID = process.env.ACCOUNT_ID;

const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;

const PLANS = {
  bronze: {
    price: 9.99,
    groupId: "-1003806027540"
  },
  silver: {
    price: 17.90,
    groupId: "-1003847434517"
  },
  gold: {
    price: 22.90,
    groupId: "-1003937048123"
  },
  vitalicio: {
    price: 30.00,
    groupId: "-1003938274858"
  }
};

// ================= TELEGRAM =================
app.post("/telegram", async (req, res) => {
  try {
    const body = req.body;

    // ===== /START =====
    if (body.message) {
      const message = body.message;

      if (message.chat.type !== "private") return res.sendStatus(200);
      if (message.text !== "/start") return res.sendStatus(200);

      const chatId = message.chat.id;

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

    // ===== CLIQUE NO PLANO =====
    if (body.callback_query) {
      const callback = body.callback_query;
      const plan = callback.data;
      const chatId = callback.message.chat.id;

      if (!PLANS[plan]) return res.sendStatus(200);

      // ✅ 1. Gerar token
      const auth = await axios.post(
        "https://api.syncpayments.com.br/api/partner/v1/auth-token",
        {
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          "01K1259MAXE0TNRXV2C2WQN2MV": ACCOUNT_ID
        },
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          }
        }
      );

      const token = auth.data.access_token;

      // ✅ 2. Criar cobrança
      const cashin = await axios.post(
        "https://api.syncpayments.com.br/api/partner/v1/cash-in",
        {
          amount: PLANS[plan].price,
          description: `Plano ${plan}`,
          webhook_url: "https://bot-telegram-u7jp.onrender.com/syncpay",
          client: {
            name: callback.from.first_name || "Cliente",
            cpf: "12345678900",
            email: "teste@email.com",
            phone: "11999999999"
          },
          metadata: {
            telegram_user_id: chatId,
            plan: plan
          }
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json"
          }
        }
      );
      
console.log("RETORNO CASHIN:", cashin.data);
      
    const pixCode = cashin.data.pix_code;

      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: `✅ PIX gerado!\n\nCopie e pague:\n\n${pixCode}\n\nApós o pagamento você receberá o acesso automaticamente.`
      });

      return res.sendStatus(200);
    }

    return res.sendStatus(200);

  } catch (err) {
    console.error(err.response?.data || err.message);
    return res.sendStatus(200);
  }
});

// ================= WEBHOOK SYNCPAY =================
app.post("/syncpay", async (req, res) => {
  try {
    const payload = req.body;
    console.log("Webhook recebido:", payload);

    if (payload.data?.status !== "completed") {
      return res.sendStatus(200);
    }

    const chatId = payload.data?.metadata?.telegram_user_id;
    const plan = payload.data?.metadata?.plan;

    if (!chatId || !plan || !PLANS[plan]) {
      return res.sendStatus(200);
    }

    const groupId = PLANS[plan].groupId;

    const invite = await axios.post(`${TELEGRAM_API}/createChatInviteLink`, {
      chat_id: groupId,
      member_limit: 1
    });

    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: `🎉 Pagamento aprovado!\n\nClique para acessar:\n${invite.data.result.invite_link}`
    });

    return res.sendStatus(200);

  } catch (err) {
    console.error(err.response?.data || err.message);
    return res.sendStatus(200);
  }
});

// ================= TESTES =================
app.get("/test-auth", async (req, res) => {
  try {
    const response = await axios.post(
      "https://api.syncpayments.com.br/api/partner/v1/auth-token",
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        "01K1259MAXE0TNRXV2C2WQN2MV": ACCOUNT_ID
      },
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        }
      }
    );

    res.json(response.data);
  } catch (err) {
    res.json(err.response?.data || err.message);
  }
});

// ================= SERVER =================
app.listen(process.env.PORT || 3000, () => {
  console.log("Bot rodando...");
});
