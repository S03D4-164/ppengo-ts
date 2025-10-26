import createError from "http-errors";
import express, { Request, Response, NextFunction } from "express";
import paginate from "express-paginate";
import path from "path";
import cookieParser from "cookie-parser";
import { doubleCsrf } from "csrf-csrf";
import bodyParser from "body-parser";
import session from "express-session";
import dotenv from "dotenv";
import logger from "./utils/logger";
import mongoose from "mongoose";
import mongoStore from "connect-mongo";
import passport from "passport";
import morgan from "morgan";
import Agenda from "agenda";
import moment from "moment";
import router from "./routes/index";
import apiRouter from "./routes/api";
import UserModel from "./models/user";

dotenv.config();

process.env.MONGO_DATABASE =
  process.env.MONGO_DATABASE || "mongodb://localhost:27017/wgeteer";

// Mongoose setup
mongoose
  .connect(process.env.MONGO_DATABASE || "", {})
  .then(() => logger.debug("[mongoose] connect completed"))
  .catch((err: Error) => logger.error(err));

mongoose.set("maxTimeMS", 30000);
mongoose.set("debug", (coll: string, method: string, query: any, doc: any) => {
  logger.debug(
    `${coll} ${method} ${JSON.stringify(query)} ${JSON.stringify(doc)}`
  );
});

// Passport setup
passport.use(UserModel.createStrategy());
passport.serializeUser(UserModel.serializeUser() as any);
passport.deserializeUser(UserModel.deserializeUser());

const app = express();
const rootPath = "/ppengo/";

// Middleware
app.use(morgan("combined"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json({ limit: "32mb" }));
//app.use(paginate.middleware(100, 1000));
app.use(paginate.middleware(10, 100));
//app.use(rootPath + "api", require("./routes/api"));
app.use(rootPath, express.static(path.join(__dirname, "public")));
app.use(
  rootPath + "js",
  express.static(path.join(__dirname, "node_modules/bootstrap/dist/js"))
);
app.use(
  rootPath + "js",
  express.static(path.join(__dirname, "node_modules/jquery/dist"))
);
app.use(
  rootPath + "css",
  express.static(path.join(__dirname, "node_modules/bootstrap/dist/css"))
);
app.use(
  "/favicon.ico",
  express.static(path.join(__dirname, "public/favicon.ico"))
);

app.use(
  session({
    secret: "keyboard cat",
    resave: false,
    saveUninitialized: true,
    store: mongoStore.create({
      mongoUrl: process.env.MONGO_DATABASE || "",
    }),
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(cookieParser());

const { generateToken } = doubleCsrf({
  getSecret: () => "Secret",
});

app.use((req: Request, res: Response, next: NextFunction) => {
  const ignoreUris = ["^/ppengo/api/.*$"];
  for (const uri of ignoreUris) {
    if (req.url.match(uri)) {
      next();
      return;
    }
  }
  const csrfToken = generateToken(req, res);
  res.locals.csrfToken = csrfToken;
  next();
});

app.use((req: Request, res: Response, next: NextFunction) => {
  res.locals.login = req.isAuthenticated();
  res.locals.user = req.user;
  next();
});

// Routes
app.use(rootPath, router);
app.use(rootPath + "api", apiRouter);

// View engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.locals.moment = moment;

//app.get("/favicon.ico", (req, res) => res.status(204));

// Catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404));
});

// Error handler
app.use((err: any, req: Request, res: Response) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  res.status(err.status || 500);
  res.render("error");
});

export default app;
