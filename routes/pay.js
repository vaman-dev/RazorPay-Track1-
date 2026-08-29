import express from "express";

import {
    createPaymentForCart,
} from "../services/paymentService.js";


const router =
    express.Router();


// =========================================================
// POST /pay
// =========================================================
//
// Body:
//
// {
//     "cart_id": "cart_xxx"
// }
//
// No amount.
// No currency.
//
// Payment details are inherited from approved Cart.
//

router.post(
    "/",
    async (
        req,
        res,
        next
    ) => {

        try {

            const {
                cart_id,
            } = req.body;


            const payment =
                await createPaymentForCart(
                    cart_id
                );


            const statusCode =
                payment.already_exists
                    ? 200
                    : 201;


            res
                .status(statusCode)
                .json({

                    success:
                        true,

                    message:
                        payment.already_exists

                            ? "Payment order already exists for this Cart"

                            : "Razorpay Order created successfully",

                    data:
                        payment,

                });

        }
        catch (error) {

            next(error);

        }

    }
);


export default router;