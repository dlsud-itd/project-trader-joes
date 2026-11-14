/**
 * Retries beyond this are refused with 409 instead of calling Gemini again.
 * Counting the first screening as attempt 0, this allows 1 initial screening
 * plus this many retries per application, so one application (or one buggy
 * client hammering "retry": true) can't burn unlimited calls against the
 * quota-limited, billed Gemini API.
 */
export const MAX_SCREENING_RETRIES = 5;

/**
 * Screenings run one at a time (see ScreeningQueue). Past this many waiting
 * (including the one running), new requests are refused with 503 instead of
 * piling up unbounded in memory.
 */
export const MAX_SCREENING_QUEUE_SIZE = 20;
