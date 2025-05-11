import { createLogger, format, transports, Logger } from "winston";
const { combine, timestamp, label, printf, simple } = format;

// Define the custom log format
const prettyJson = printf((info: any) => {
  if (info.message && typeof info.message === "object") {
    info.message = JSON.stringify(info.message, null, 4);
  }
  return `${info.timestamp} [${info.level}] ${info.message}`;
});

// Create the logger instance
const logger: Logger = createLogger({
  format: combine(
    label({ label: "ppengo" }),
    timestamp(),
    simple(),
    prettyJson
  ),
  transports: [
    new transports.File({
      level: "info",
      filename: "./public/logs/ppengo.log",
      handleExceptions: true,
      format: format.json(),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new transports.Console({
      level: "debug",
      handleExceptions: true,
      format: format.combine(format.colorize(), format.simple()),
    }),
  ],
  exitOnError: false,
});

export default logger;
