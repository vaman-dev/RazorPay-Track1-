// =========================================================
// ENVIRONMENT CONFIGURATION
// =========================================================

import "dotenv/config";


// =========================================================
// IMPORTS
// =========================================================

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import payRoutes from "./routes/pay.js";
import db from "./db/db.js";
import webhookRoutes from "./routes/webhook.js";
import intentRoutes from "./routes/intent.js";
import cartRoutes from "./routes/cart.js";
import traceRoutes from "./routes/trace.js";
import chatRoutes from "./routes/chat.js";
// =========================================================
// APP SETUP
// =========================================================

const app = express();

const PORT =
    Number(process.env.PORT) || 3000;


// =========================================================
// PATH SETUP
// =========================================================

const __filename =
    fileURLToPath(import.meta.url);

const __dirname =
    path.dirname(__filename);


// =========================================================
// BASIC EXPRESS CONFIGURATION
// =========================================================

app.disable("x-powered-by");


// =========================================================
// RAZORPAY WEBHOOK
// =========================================================

app.use(
    "/webhook",
    express.raw({
        type: "application/json",
    }),
    webhookRoutes
);

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true,
    })
);

// =========================================================
// Tracing routes
// =========================================================
app.use(
    "/trace",
    traceRoutes
);

// =========================================================
// Chat routes
// =========================================================

app.use(
    "/chat",
    chatRoutes
);

// =========================================================
// NORMAL BODY PARSING
// =========================================================

app.use(
    express.json()
);

app.use(
    express.urlencoded({
        extended: true,
    })
);


// =========================================================
// STATIC FILES
// =========================================================
//
// public/dashboard.html
//
// will become:
//
// http://localhost:3000/dashboard.html
//

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);


// =========================================================
// ROOT ROUTE
// =========================================================

app.get("/", (req, res) => {

    res.status(200).json({

        success: true,

        service:
            "Mandate Ledger API",

        message:
            "Agentic payment authorization and audit service is running.",

    });

});


// =========================================================
// HEALTH CHECK
// =========================================================

app.get(
    "/health",
    (req, res, next) => {

        try {

            const databaseCheck =
                db
                    .prepare(
                        "SELECT 1 AS connected"
                    )
                    .get();


            const databaseConnected =
                databaseCheck?.connected === 1;


            res.status(200).json({

                success: true,

                service:
                    "Mandate Ledger",

                environment:
                    process.env.NODE_ENV ||
                    "development",

                server:
                    "running",

                database:
                    databaseConnected
                        ? "connected"
                        : "disconnected",

                timestamp:
                    new Date().toISOString(),

            });

        }
        catch (error) {

            next(error);

        }

    }
);


// =========================================================
// API ROUTES
// =========================================================


// ---------------------------------------------------------
// INTENT MANDATE ROUTES
// ---------------------------------------------------------
//
// POST   /intent
// GET    /intent/:id
// PATCH  /intent/:id/approve
//

app.use(
    "/intent",
    intentRoutes
);


// ---------------------------------------------------------
// CART MANDATE ROUTES
// ---------------------------------------------------------
// POST /cart
// GET  /cart/:id
app.use(
    "/cart",
    cartRoutes
);
//
app.use("/pay", payRoutes);
//
// app.use("/dashboard", dashboardRoutes);
//
// Razorpay webhook will NOT be mounted here.
// It must remain above express.json().
//


// =========================================================
// 404 HANDLER
// =========================================================
//
// Must remain AFTER every valid route.
//

app.use((req, res) => {

    res.status(404).json({

        success: false,

        error:
            "ROUTE_NOT_FOUND",

        message:
            `No route exists for ${req.method} ${req.originalUrl}`,

    });

});


// =========================================================
// GLOBAL ERROR HANDLER
// =========================================================

app.use(
    (err, req, res, next) => {

        console.error(
            `[${new Date().toISOString()}]`,
            err
        );


        if (res.headersSent) {

            return next(err);

        }


        const statusCode =
            Number.isInteger(err.status)
                ? err.status
                : 500;


        res
            .status(statusCode)
            .json({

                success: false,

                error:
                    err.code ||
                    "INTERNAL_SERVER_ERROR",

                message:
                    err.message ||
                    "An unexpected server error occurred.",

            });

    }
);


// =========================================================
// START SERVER
// =========================================================

const server =
    app.listen(
        PORT,
        () => {

            console.log("");
            console.log(
                "========================================"
            );

            console.log(
                "MANDATE LEDGER"
            );

            console.log(
                "========================================"
            );

            console.log(
                `Environment : ${
                    process.env.NODE_ENV ||
                    "development"
                }`
            );

            console.log(
                `Server      : http://localhost:${PORT}`
            );

            console.log(
                `Health      : http://localhost:${PORT}/health`
            );

            console.log(
                `Intent API  : http://localhost:${PORT}/intent`
            );

            console.log(
                `Cart API    : http://localhost:${PORT}/cart`
            );

            console.log(
                `Pay API     : http://localhost:${PORT}/pay`
            );

            console.log(
                 `Webhook API : http://localhost:${PORT}/webhook`
            );

            console.log(
            `Trace API   : http://localhost:${PORT}/trace/:trace_id`
            );

            console.log(
                `Chat API    : http://localhost:${PORT}/chat`
            );

            console.log(
                "========================================"
            );
            console.log("");

        }
    );


// =========================================================
// SERVER ERROR HANDLING
// =========================================================

server.on(
    "error",
    (error) => {

        if (
            error.code === "EADDRINUSE"
        ) {

            console.error(
                `Port ${PORT} is already in use.`
            );

            console.error(
                "Stop the existing process or change PORT in .env."
            );

        }
        else {

            console.error(
                "HTTP server error:",
                error
            );

        }

    }
);


// =========================================================
// GRACEFUL SHUTDOWN
// =========================================================

function shutdown(signal) {

    console.log("");
    console.log(
        `${signal} received.`
    );

    console.log(
        "Shutting down Mandate Ledger..."
    );


    server.close(() => {

        try {

            db.close();

            console.log(
                "SQLite connection closed."
            );

        }
        catch (error) {

            console.error(
                "Failed to close SQLite connection:",
                error
            );

        }


        console.log(
            "HTTP server stopped."
        );

        process.exit(0);

    });


    // Safety fallback:
    // If some connection prevents shutdown,
    // force termination after 5 seconds.

    setTimeout(() => {

        console.error(
            "Forced shutdown after timeout."
        );

        process.exit(1);

    }, 5000).unref();

}


process.on(
    "SIGINT",
    () => shutdown("SIGINT")
);

process.on(
    "SIGTERM",
    () => shutdown("SIGTERM")
);
