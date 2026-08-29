# Mandate Ledger — Project Implementation Plan

## 1. Goal
Ek web app jo AP2-style Intent → Cart → Payment mandate chain implement kare, Razorpay test-mode APIs ke saath, with audit dashboard + spend caps + failure handling.

## 2. Folder Structure & File Responsibility

```
mandate-ledger/
├── .env                        # Razorpay keys, JWT secret
├── package.json
├── server.js                   # Express app entry, mounts all routes
├── db/
│   ├── schema.sql               # intents, carts, payments tables
│   └── db.js                    # SQLite connection + helper queries
├── routes/
│   ├── intent.js                # POST /intent
│   ├── cart.js                  # POST /cart
│   ├── pay.js                   # POST /pay
│   ├── webhook.js                # POST /webhook (Razorpay callbacks)
│   └── dashboard.js             # GET /dashboard (audit view)
├── services/
│   ├── consentManager.js        # create + sign Intent/Cart mandates
│   ├── spendCapController.js    # cap validation logic
│   ├── razorpayAdapter.js       # only file touching Razorpay SDK
│   ├── ledger.js                # writes audit entries, chain lookups
│   └── escalation.js            # failure classification + fallback response
├── public/
│   └── dashboard.html           # simple table UI
└── README.md
```

## 3. Data Model (db/schema.sql)

| Table | Key Columns |
|---|---|
| `intents` | id, scope, max_amount, valid_until, signature, status |
| `carts` | id, intent_id (FK), merchant, items, amount, signature, status |
| `payments` | id, cart_id (FK), razorpay_order_id, razorpay_payment_id, status, signature |

Status values: `pending`, `approved`, `rejected`, `captured`, `failed`.

## 4. Build Order (Day-wise)

| Day | Task | Files touched |
|---|---|---|
| **Day 1** | Project setup, Razorpay test keys, DB schema, `db.js` connection working | `.env`, `db/*` |
| **Day 2** | Intent + Cart routes — create, sign (JWT), store, cap check | `routes/intent.js`, `routes/cart.js`, `services/consentManager.js`, `services/spendCapController.js` |
| **Day 3** | Razorpay Adapter — `orders.create`, `/pay` route wired to a Cart | `routes/pay.js`, `services/razorpayAdapter.js` |
| **Day 4** | Webhook listener — signature verify, update `payments` table | `routes/webhook.js` (test via ngrok) |
| **Day 5** | Ledger service — join intents+carts+payments into one chain view | `services/ledger.js` |
| **Day 6** | Dashboard — table UI showing full chain + status | `routes/dashboard.js`, `public/dashboard.html` |
| **Day 7** | Escalation — force one failure (cap breach or `payment.failed`), show reason on dashboard; polish + demo run-through | `services/escalation.js` |

## 5. Definition of Done (MVP)
- [ ] Intent can be created with a spend cap
- [ ] Cart rejected if amount exceeds Intent cap
- [ ] Cart triggers real Razorpay test order
- [ ] Webhook correctly updates payment status
- [ ] Dashboard shows full Intent→Cart→Payment chain per transaction
- [ ] At least one failure case is visibly caught and explained, not silent

## 6. Out of Scope (say this explicitly in demo)
Multi-merchant routing, real KYC/RBI compliance, production fraud-ML, live-mode payments.

## 7. Immediate Next Action
Generate Razorpay test API keys → put in `.env` → confirm a raw `orders.create()` call works before writing any mandate logic on top.