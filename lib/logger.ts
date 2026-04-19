import winston from "winston";
import path from "path";

const { combine, timestamp, colorize, printf, json, errors } = winston.format;

const devFormat = combine(
  errors({ stack: true }),
  timestamp({ format: "HH:mm:ss" }),
  colorize(),
  printf(({ level, message, timestamp: ts, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `${ts} [${level}] ${message}${metaStr}`;
  })
);

const prodFormat = combine(errors({ stack: true }), timestamp(), json());

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: process.env.NODE_ENV === "production" ? prodFormat : devFormat,
  }),
];

if (process.env.NODE_ENV === "production") {
  transports.push(
    new winston.transports.File({
      filename: path.join(process.cwd(), "logs", "error.log"),
      level: "error",
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
      format: prodFormat,
    }),
    new winston.transports.File({
      filename: path.join(process.cwd(), "logs", "combined.log"),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 10,
      format: prodFormat,
    })
  );
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  transports,
  exitOnError: false,
});
