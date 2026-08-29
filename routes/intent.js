import express from "express";

import {
    createIntent,
    getIntentById,
    approveIntent,
} from "../services/consentManager.js";


const router = express.Router();


// =========================================================
// POST /intent
// Create a new pending Intent Mandate
// =========================================================

router.post("/", (req, res, next) => {

    try {

        const intent =
            createIntent(
                req.body
            );


        res.status(201).json({

            success: true,

            message:
                "Intent mandate created successfully",

            data:
                intent,

        });

    }
    catch (error) {

        next(error);

    }

});


// =========================================================
// GET /intent/:id
// =========================================================

router.get("/:id", (req, res, next) => {

    try {

        const intent =
            getIntentById(
                req.params.id
            );


        if (!intent) {

            const error =
                new Error(
                    "Intent not found"
                );

            error.status = 404;
            error.code =
                "INTENT_NOT_FOUND";

            throw error;

        }


        res.status(200).json({

            success: true,

            data:
                intent,

        });

    }
    catch (error) {

        next(error);

    }

});


// =========================================================
// PATCH /intent/:id/approve
// Explicit consent step
// =========================================================

router.patch(
    "/:id/approve",
    (req, res, next) => {

        try {

            const intent =
                approveIntent(
                    req.params.id
                );


            res.status(200).json({

                success: true,

                message:
                    "Intent approved successfully",

                data:
                    intent,

            });

        }
        catch (error) {

            next(error);

        }

    }
);


export default router;