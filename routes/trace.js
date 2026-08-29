import express from "express";

import {
    getTraceById
} from "../services/traceService.js";


const router =
    express.Router();


// =========================================================
// GET /trace/:trace_id
// =========================================================

router.get(
    "/:trace_id",
    (
        req,
        res,
        next
    ) => {

        try {

            const result =
                getTraceById(
                    req.params.trace_id
                );


            return res
                .status(200)
                .json({

                    success: true,

                    message:
                        "Trace retrieved successfully",

                    data:
                        result,

                });

        }
        catch (error) {

            next(error);

        }

    }
);


export default router;