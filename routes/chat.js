import express from "express";

import {

    handleChatMessage,
    deleteChatSession,

} from "../services/chatOrchestrator.js";


const router =
    express.Router();


// =========================================================
// POST /chat
// =========================================================
//
// Normal:
//
// {
//     "message": "I want running shoes under ₹3000"
// }
//
// Continue:
//
// {
//     "session_id": "chat_xxx",
//     "message": "yes"
// }
//
// Explicit UI confirmation:
//
// {
//     "session_id": "chat_xxx",
//     "confirm": true
// }
//
// Cancel:
//
// {
//     "session_id": "chat_xxx",
//     "cancel": true
// }
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

                session_id =
                    null,

                message =
                    "",

                confirm =
                    false,

                cancel =
                    false,

            } = req.body || {};


            const result =
                await handleChatMessage({

                    sessionId:
                        session_id,

                    userMessage:
                        message,

                    confirm:
                        confirm === true,

                    cancel:
                        cancel === true,

                });


            return res
                .status(200)
                .json({

                    success:
                        true,

                    data:
                        result,

                });

        }
        catch (error) {

            next(error);

        }

    }
);


// =========================================================
// DELETE /chat/:session_id
// =========================================================
//
// Clears development/in-memory conversation state.
//

router.delete(
    "/:session_id",
    (
        req,
        res,
        next
    ) => {

        try {

            const deleted =
                deleteChatSession(
                    req.params.session_id
                );


            return res
                .status(200)
                .json({

                    success:
                        true,

                    message:
                        deleted
                            ? "Chat session deleted successfully"
                            : "Chat session did not exist",

                });

        }
        catch (error) {

            next(error);

        }

    }
);


export default router;