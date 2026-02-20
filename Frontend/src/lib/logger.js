import pino from "pino";

const isProd = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.PROD;

const logger = pino({
  level: isProd ? "info" : "debug",
  transport: isProd ? undefined : { target: "pino-pretty" },
});

export default logger;
