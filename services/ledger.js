import db from "../db/db.js";


// =========================================================
// WRITE AUDIT EVENT
// =========================================================

export function writeAuditEvent({
    traceId,
    entityType,
    entityId,
    event,
    previousStatus = null,
    newStatus = null,
    reasonCode = null,
    detail = null,
    metadata = null,
}) {

    const statement = db.prepare(`
        INSERT INTO audit_log (
            trace_id,
            entity_type,
            entity_id,
            event,
            previous_status,
            new_status,
            reason_code,
            detail,
            metadata
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);


    const serializedMetadata =
        metadata === null
            ? null
            : JSON.stringify(metadata);


    const result = statement.run(
        traceId,
        entityType,
        entityId,
        event,
        previousStatus,
        newStatus,
        reasonCode,
        detail,
        serializedMetadata
    );


    return result.lastInsertRowid;
}