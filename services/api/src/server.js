const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const APP_NAME = process.env.APP_NAME || "PayLanka Nano API";
const PORT     = process.env.PORT || 8000;

const store = new Map();

app.get("/health", (req, res) => res.json({ status: "ok", service: APP_NAME, now: new Date().toISOString() }));
app.get("/ping",   (req, res) => res.json({ pong: true }));

// List all payments
app.get("/payments", (req, res) => {
  const all = Array.from(store.values())
    .sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ ok:true, count: all.length, payments: all });
});

// Clear all (demo)
app.delete("/payments", (req, res) => {
  store.clear();
  res.json({ ok:true, cleared:true });
});

app.post("/pay", (req, res) => {
  const { amount, currency, card, exp, cvc } = req.body || {};
  if (!(Number(amount) > 0)) return res.status(400).json({ ok:false, error:"Amount must be > 0" });
  const cur = (currency || "LKR").toUpperCase();
  if (!/^[A-Z]{3}$/.test(cur))        return res.status(400).json({ ok:false, error:"Currency must be 3-letter code" });
  if (!/^\d{12,19}$/.test(card||""))  return res.status(400).json({ ok:false, error:"Card must be 12-19 digits" });
  if (!/^\d{2}\/\d{2}$/.test(exp||""))return res.status(400).json({ ok:false, error:"Expiry MM/YY required" });
  if (!/^\d{3,4}$/.test(cvc||""))     return res.status(400).json({ ok:false, error:"CVC 3-4 digits required" });

  const id = uuidv4();
  const payment = {
    id,
    amount: Number(amount),
    currency: cur,
    masked: "**** **** **** " + String(card).slice(-4),
    status: "succeeded",
    createdAt: new Date().toISOString()
  };
  store.set(id, payment);
  res.json({ ok:true, payment });
});

app.get("/pay/:id", (req, res) => {
  const p = store.get(req.params.id);
  if (!p) return res.status(404).json({ ok:false, error:"Not found" });
  res.json({ ok:true, payment: p });
});

app.listen(PORT, () => console.log(APP_NAME + " listening on " + PORT));