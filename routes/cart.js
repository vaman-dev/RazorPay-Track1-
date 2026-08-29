import express from "express";

import {
    createCart,
    getCartById,
} from "../services/consentManager.js";


const router = express.Router();


// =========================================================
// POST /cart
// Create an approved Cart Mandate linked to an Intent.
// =========================================================

router.post("/", (req, res, next) => {

    try {

        const cart =
            createCart(
                req.body
            );


        res.status(201).json({

            success: true,

            message:
                "Cart mandate created successfully",

            data:
                cart,

        });

    }
    catch (error) {

        next(error);

    }

});


// =========================================================
// GET /cart/:id
// =========================================================

router.get("/:id", (req, res, next) => {

    try {

        const cart =
            getCartById(
                req.params.id
            );


        if (!cart) {

            const error =
                new Error(
                    "Cart not found"
                );

            error.status = 404;
            error.code =
                "CART_NOT_FOUND";

            throw error;

        }


        res.status(200).json({

            success: true,

            data:
                cart,

        });

    }
    catch (error) {

        next(error);

    }

});


export default router;
