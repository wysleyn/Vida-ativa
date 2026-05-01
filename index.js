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
const STATS_FILE = "/tmp/stats.json";
const USER_STATE_FILE = "/tmp/user_state.json";
const ADMIN_ID = "8761512517";

const PLANS = {
  bronze:    { nome: "Bronze",    valor: 5.90,  groupId: "-1003806027540" },
  silver:    { nome: "Silver",    valor: 9.90,  groupId: "-1003847434517" },
  gold:      { nome: "Gold",      valor: 14.90, groupId: "-1003937048123" },
  vitalicio: { nome: "Vitalício", valor: 20.00, groupId: "-1003938274858" }
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

function loadStats() {
  try {
    if (fs.existsSync(STATS_FILE)) {
      return JSON.parse(fs.readFileSync(STATS_FILE, "utf8"));
    }
  } catch(e) {}
  return { leads: 0, pixGerados: 0, pagamentos: 0, faturamento: 0 };
}

function saveStats(data) {
  try {
    fs.writeFileSync(STATS_FILE, JSON.stringify(data), "utf8");
  } catch(e) {}
}

function loadUserState() {
  try {
    if (fs.existsSync(USER_STATE_FILE)) {
      return JSON.parse(fs.readFileSync(USER_STATE_FILE, "utf8"));
    }
  } catch(e) {}
  return {};
}

function saveUserState(data) {
  try {
    fs.writeFileSync(USER_STATE_FILE, JSON.stringify(data), "utf8");
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

      const chatId = message.chat.id;

      // COMANDO /stats
      if (message.text === "/stats") {
        if (String(chatId) !== ADMIN_ID) return res.sendStatus(200);
        const stats = loadStats();
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: `📊 *ESTATÍSTICAS DO BOT*\n\n👥 Leads: ${stats.leads}\n💳 PIX gerados: ${stats.pixGerados}\n✅ Pagamentos: ${stats.pagamentos}\n💰 Faturamento: R$ ${stats.faturamento.toFixed(2)}\n\n📈 Conversão Lead→PIX: ${stats.leads > 0 ? ((stats.pixGerados/stats.leads)*100).toFixed(1) : 0}%\n💵 Conversão PIX→Pago: ${stats.pixGerados > 0 ? ((stats.pagamentos/stats.pixGerados)*100).toFixed(1) : 0}%`,
          parse_mode: "Markdown"
        });
        return res.sendStatus(200);
      }

      if (message.text !== "/start") return res.sendStatus(200);

      // CONTA NOVO LEAD
      const stats = loadStats();
      stats.leads += 1;
      saveStats(stats);

      // MARCA ESTADO DO USUÁRIO
      const userState = loadUserState();
      userState[chatId] = {
        paid: false,
        reminderSent: false
      };
      saveUserState(userState);

      // AVISO DE NOVO LEAD PARA O ADMIN
      axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: ADMIN_ID,
        text: `🚀 *Novo Lead!*\n👤 Nome: ${message.from.first_name}\n🆔 ID: ${chatId}\n👤 Username: @${message.from.username || 'sem_username'}\n\n📊 Total leads hoje: ${stats.leads}`,
        parse_mode: "Markdown"
      }).catch(e => {});

      await axios.post(`${TELEGRAM_API}/sendMediaGroup`, {
        chat_id: chatId,
        media: [
          {
            type: "photo",
            media: "AgACAgEAAxkBAAMmaefX9d5_BnGOsZNe5jajEjs5mM0AAisMaxsv-DhH6hrvYqGw0ZsBAAMCAAN5AAM7BA"
          },
          {
            type: "photo",
            media: "AgACAgEAAxkBAAMOaeeqn3T1AZSGEfeM1aeVemRpv38AAgoMaxtioDhHr6tDUDO92ZIBAAMCAAN5AAM7BA"
          },
          {
            type: "photo",
            media: "AgACAgEAAxkBAAMoaefYGe3b4S1tZgkWEs20W9jYBKoAAiwMaxsv-DhHMSF_vk9wDigBAAMCAAN5AAM7BA"
          },
          {
            type: "video",
            media: "BAACAgEAAxkBAAMRaeeqn9Bdg5TLp7bA2KCu_-sX6E8AAi8IAAJioDhHoUy3V8Eymv07BA"
          },
          {
            type: "video",
            media: "BAACAgEAAxkBAAEdtTxp9A6sLHDExTVMT2PP41sHN9wT-AACcAYAAkF0oEc6eyWjMY5weDsE"
          }
        ]
      });

      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: `🚨 VOCÊ CONSEGUIU ACESSO... MAS SÓ POR HOJE 🚨

Eu não mando isso pra qualquer um. Você foi escolhido pra ver o que fica escondido do público. 😈

Aqui dentro é diferente. Sem filtro, sem roupa, sem frescura. 🔞🔥

Olha o que cada plano te entrega na hora:

🥉 BRONZE - R$ 5,90
Gostinho do que tá por vir. Fotos e videos exclusivos que não aparecem em lugar nenhum.

🥈 SILVER - R$ 9,90
O favorito! Fotos + meus vídeos mais quentes. Você vai querer mais.

🥇 GOLD - R$ 14,90
Visão total. Tudo do Silver + vídeos longos, sem corte e sem censura. Do jeito que você gosta.

💎 VITALÍCIO - R$ 20,00
ACESSO PARA SEMPRE. Todo conteúdo que já postei + tudo que vou postar. Novidades toda semana. Quem entra não quer sair. 🔒

⚡ PIX gerado na hora. Link do grupo cai aqui no chat em segundos.

👇 Escolha seu plano agora:`
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

      // REMARKETING APÓS 4 MINUTOS PARA QUEM NÃO PAGOU
      setTimeout(async () => {
        try {
          const state = loadUserState();
          const current = state[chatId];

          if (!current) return;
          if (current.paid) return;
          if (current.reminderSent) return;

          await axios.post(`${TELEGRAM_API}/sendVideo`, {
            chat_id: chatId,
            video: "BAACAgEAAxkBAAEdtUxp9BP1olcmVVicLJAjhKwCA5SzEgAC2AYAAvuYQEcxPKPuahhCvTsE",
            caption: `Oi mo, vi que você deu start... mas parou bem na hora que ia entrar no mundinho rosa 🥺

Tá pensando em quê? Eu to aqui toda molhadinha imaginando você me chamando no direct pra brincar com sua putinha preferida 😘🍑

Vou liberar o meu direct pra você se você comprar agora! Prometo que a gente vai gozar bem gostoso 🍆🤤

Ultima chances, não me decepcione.... clica agora e me chama 👇👇`,
            reply_markup: {
              inline_keyboard: [
                [{ text: "Meu conteudo + meu direct (5,90)", callback_data: "bronze" }]
              ]
            }
          });

          state[chatId].reminderSent = true;
          saveUserState(state);

        } catch (e) {
          console.log("Erro ao enviar lembrete:", e.message);
        }
      }, 4 * 60 * 1000);

      return res.sendStatus(200);
    }

    if (body.callback_query) {
      const callback = body.callback_query;
      const plan = callback.data;
      const chatId = callback.message.chat.id;

      if (!PLANS[plan]) return res.sendStatus(200);

      // AVISO DE CLIQUE NO PLANO
      axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: ADMIN_ID,
        text: `💳 *Lead clicou em um plano!*\n🆔 ID: ${chatId}\n📌 Plano: ${PLANS[plan].nome}\n💰 Valor: R$ ${PLANS[plan].valor.toFixed(2)}`,
        parse_mode: "Markdown"
      }).catch(e => {});

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

        // CONTA PIX GERADO
        const stats = loadStats();
        stats.pixGerados += 1;
        saveStats(stats);

        console.log(`PIX gerado: ${transactionId} para ${chatId} plano ${plan}`);

        // AVISO DE PIX GERADO
        axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: ADMIN_ID,
          text: `⚡ *PIX Gerado!*\n🆔 ID: ${chatId}\n📌 Plano: ${PLANS[plan].nome}\n💰 Valor: R$ ${PLANS[plan].valor.toFixed(2)}\n🔑 Transaction: ${transactionId}`,
          parse_mode: "Markdown"
        }).catch(e => {});

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

app.get("/sigilopay", (req, res) => res.sendStatus(200));

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

    if (!isPaid) return res.sendStatus(200);

    const pending = loadPending();
    const userData = pending[transactionId];

    if (!userData) {
      console.log("Usuário não encontrado:", transactionId);
      return res.sendStatus(200);
    }

    const { chatId, plan } = userData;
    const groupId = PLANS[plan].groupId;

    // MARCA QUE PAGOU
    const state = loadUserState();
    if (state[chatId]) {
      state[chatId].paid = true;
      saveUserState(state);
    }

    const invite = await axios.post(`${TELEGRAM_API}/createChatInviteLink`, {
      chat_id: groupId,
      member_limit: 1
    });

    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: `🎉 *Pagamento aprovado!*\n\nSeu acesso foi liberado! Clique abaixo para entrar no grupo VIP:\n${invite.data.result.invite_link}`,
      parse_mode: "Markdown"
    });

    // CONTA PAGAMENTO E FATURAMENTO
    const stats = loadStats();
    stats.pagamentos += 1;
    stats.faturamento += PLANS[plan].valor;
    saveStats(stats);

    // AVISO DE VENDA PARA O ADMIN
    axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: ADMIN_ID,
      text: `💰 *VENDA REALIZADA!*\n🆔 ID: ${chatId}\n📌 Plano: ${PLANS[plan].nome}\n💵 Valor: R$ ${PLANS[plan].valor.toFixed(2)}\n\n📊 Total vendas: ${stats.pagamentos}\n💰 Faturamento total: R$ ${stats.faturamento.toFixed(2)}`,
      parse_mode: "Markdown"
    }).catch(e => {});

    delete pending[transactionId];
    savePending(pending);

    console.log(`Acesso liberado para ${chatId} plano ${plan}`);
    return res.sendStatus(200);

  } catch (err) {
    console.error("Erro webhook:", err);
    return res.sendStatus(200);
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Bot rodando...");
});
