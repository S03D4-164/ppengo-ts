import Agenda, { Job, JobPriority } from "agenda";
import logger from "../utils/logger";

import WebsiteModel from "../models/website";
import WebpageModel from "../models/webpage";
import ResponseModel from "../models/response";

//const mail = require("./mail");
import { yaraPage } from "../utils/yara";
//const wappalyze = require("./wappalyze");
import { analyze } from "../utils/wappalyzer";

process.env.MONGO_DATABASE =
  process.env.MONGO_DATABASE || "mongodb://localhost:27017/wgeteer";

const agenda = new Agenda({
  db: {
    address: process.env.MONGO_DATABASE,
    collection: "agendaJobs",
    options: {
      //useNewUrlParser: true,
    },
  },
  processEvery: "3 seconds",
  maxConcurrency: 4,
  defaultConcurrency: 1,
  defaultLockLifetime: 1000 * 60 * 3,
});

/*
agenda.define(
  "esIndex",
  {
    concurrency: 1,
    lockLimit: 1,
    priority: "low",
  },
  async () => {
    Response.on("es-bulk-sent", function () {
      logger.debug("buffer sent");
    });

    Response.on("es-bulk-error", function (err: Error) {
      logger.error(err);
    });

    await Response.esSynchronize();
    logger.debug("sync end.");
  },
);
*/

agenda.define(
  "crawlWeb",
  {
    //priority: JobPriority.low,
  },
  async (job: Job, done: () => void) => {
    const websites: any = await WebsiteModel.find()
      .where("track.counter")
      .gt(0)
      .populate("last");

    logger.debug("crawlWeb: " + websites.length);

    for (const website of websites) {
      const interval = 60 * 60 * 1000; // 1 hour
      const now = Math.floor(Date.now() / interval);
      const lastPage: any = await WebpageModel.findById(website.last);

      const update =
        website.track.period +
        Math.floor(lastPage.createdAt.valueOf() / interval);

      if (now >= update) {
        const webpage = new WebpageModel({
          input: website.url,
          option: website.track.option,
        });

        await webpage.save();
        logger.debug(`Saved webpage: ${webpage._id}`);

        website.track.counter -= 1;
        //website.last = webpage._id;
        await website.save();

        await agenda.now("wgeteer", { pageId: webpage._id });
      }
    }

    done();
  },
);

agenda.define(
  "analyzePage",
  {
    //priority: JobPriority.low,
  },
  async (job: Job, done: () => void) => {
    try {
      const { pageId } = job.attrs.data as { pageId: string };
      logger.debug(`wappalyzer -> ${pageId}`);
      await analyze(pageId);
      logger.debug(`yara -> ${pageId}`);
      await yaraPage(pageId);
      done();
    } catch (err) {
      logger.error(err);
      done();
    }
  },
);

agenda.define("hello world", (job: Job, done: () => void) => {
  logger.debug("agenda ready");
  done();
});

agenda.on("ready", async () => {
  const canceled = await agenda.cancel({ name: "analyzePage" });
  logger.debug(`canceled: ${canceled}`);

  await agenda.now("hello world", { time: new Date() });
  await agenda.every("*/10 * * * *", ["crawlWeb"]);
  await agenda.start();
});

agenda.on("start", (job: Job) => {
  logger.debug(`Job ${job.attrs.name} starting`);
});

agenda.on("complete", (job: Job) => {
  logger.debug(`Job ${job.attrs.name} finished`);
});

async function graceful() {
  await agenda.stop();
  process.exit(0);
}

process.on("SIGTERM", graceful);
process.on("SIGINT", graceful);

export default agenda;
