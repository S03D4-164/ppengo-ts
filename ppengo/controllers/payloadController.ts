import { Request, Response } from "express";
import archiver, { ArchiverOptions } from "archiver";
archiver.registerFormat("zip-encrypted", require("archiver-zip-encrypted"));
import paginate from "express-paginate";
import { Parser } from "@json2csv/plainjs";
import moment from "moment";
import * as yara from "../utils/yara";
import hexdump from "hexdump-nodejs";

import PayloadModel from "../models/payload";
import ResponseModel from "../models/response";
import WebpageModel from "../models/webpage";
import ScreenshotModel from "../models/screenshot";

interface PayloadDocument {
  _id: string;
  md5: string;
  payload: Buffer;
  createdAt: Date;
  tag?: string;
  yara?: any;
}

//router.get("/", async (req: Request, res: Response) => {
export const getPayloads = async (
  req: Request,
  res: Response
): Promise<void> => {
  const search: Record<string, any>[] = [];

  if (req.query.md5) {
    search.push({ md5: new RegExp(req.query.md5 as string) });
  }

  if (req.query.csv) {
    let find = PayloadModel.find();
    if (search.length) find = find.and(search);

    const payloads = await find.lean().sort("-createdAt");
    const fields = ["createdAt", "md5", "tag"];
    const opts = { withBOM: true, fields };
    const parser = new Parser(opts);
    const csv = parser.parse(payloads);

    res.setHeader("Content-disposition", "attachment; filename=payloads.csv");
    res.setHeader("Content-Type", "text/csv; charset=UTF-8");
    res.send(csv);
  } else {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const now = moment().toDate();
    const query = search.length
      ? { $and: search }
      : { createdAt: { $lte: now } };

    const result = await PayloadModel.paginate(query, {
      sort: { createdAt: -1 },
      page,
      limit,
      lean: false,
    });
    let pages: any = paginate.getArrayPages(req)(5, result.totalPages, page);
    if (page === 1) {
      for (let pg of pages) {
        if (pg.url.match(/page=NaN$/)) {
          pg.url = pg.url.replace(/page=NaN$/, `page=${pg.number}`);
        }
      }
    }
    res.render("payloads", {
      title: "Payloads",
      search: req.query,
      result,
      pages,
    });
  }
};

//router.get("/download/:id", async (req: Request, res: Response) => {
export const downloadPayload = async (
  req: Request,
  res: Response
): Promise<void> => {
  const id = req.params.id;

  const payload: any = await PayloadModel.findById(id);
  if (!payload) {
    res.status(404).send("Payload not found");
  }

  const archive = archiver.create("zip-encrypted", {
    zlib: { level: 8 },
    encryptionMethod: "aes256",
    password: "infected",
  } as unknown as ArchiverOptions);

  archive.on("error", (err: Error) => {
    res.status(500).send({ error: err.message });
  });

  const pl = Buffer.from(payload.payload, "base64");
  res.attachment(`${payload.md5}.zip`);
  archive.pipe(res);
  archive.append(pl, { name: payload.md5 });
  await archive.finalize();
};

//router.get("/:id", async (req: Request, res: Response) => {
export const getPayload = async (
  req: Request,
  res: Response
): Promise<void> => {
  const id = req.params.id;
  console.log(req.query);
  const payload: any = await PayloadModel.findById(id);
  if (!payload) {
    res.status(404).send("Payload not found");
  }

  const responses = await ResponseModel.find()
    .where({ payload: payload._id })
    .lean()
    .sort("-createdAt")
    .catch((err) => {
      console.log(err);
    });

  if (req.query.yara) {
    await yara.yaraPayload(payload._id);
    console.log(payload.yara);
  }

  let hex;
  if (payload.payload) {
    console.log(payload.payload.length);
    const sizelimit = 1024 * 1024 * 10;
    if (payload.payload.length > sizelimit) hex = "File size is too large.";
    else hex = hexdump(payload.payload);
  }

  res.render("payload", {
    payload,
    responses,
    hex,
  });
};

//router.post("/remove", async (req: Request, res: Response) => {
export const postRemovePayload = async (
  req: Request,
  res: Response
): Promise<void> => {
  console.log(req.body);
  let payloads;
  if (req.body["payload[]"]) {
    const pl = req.body["payload[]"];
    payloads = await PayloadModel.find()
      .where({ _id: { $in: pl } })
      .catch((err) => {
        console.log(err);
      });
  }
  let responses;
  if (req.body["response[]"]) {
    const res = req.body["response[]"];
    responses = await ResponseModel.find()
      .where({ _id: { $in: res } })
      .catch((err) => {
        console.log(err);
      });
  }
  let webpages;
  if (req.body["webpage[]"]) {
    const wp = req.body["webpage[]"];
    webpages = await WebpageModel.deleteMany()
      .where({ _id: { $in: wp } })
      .catch((err) => {
        console.log(err);
      });
  }
  let screenshots;
  if (req.body["ss[]"]) {
    const ss = req.body["ss[]"];
    screenshots = await ScreenshotModel.deleteMany()
      .where({ _id: { $in: ss } })
      .catch((err) => {
        console.log(err);
      });
  }
  res.render("remove", {
    payloads,
    responses,
    webpages,
    screenshots,
  });
};

//router.get("/remove/:id", async (req: Request, res: Response) => {
export const getRemovePayload = async (
  req: Request,
  res: Response
): Promise<void> => {
  const id = req.params.id;
  const payload: any = await PayloadModel.findById(id);
  if (!payload) {
    res.status(404).send("Payload not found");
  }

  const payloads: any = [payload];

  const responses: any = await ResponseModel.find()
    .where({ payload: payload._id })
    .populate({ path: "webpage", populate: { path: "screenshot" } })
    .sort("-createdAt")
    .catch((err) => {
      console.log(err);
    });

  let es = [];
  let webpages: any = [];
  let screenshots: any = [];

  for (let response of responses) {
    if (response.webpage) {
      const webpage = response.webpage;
      if (!webpages.includes(webpage)) {
        webpages.push(response.webpage);
      }
      if (webpage.screenshot) {
        const ss = webpage.screenshot;
        if (!screenshots.includes(ss)) {
          screenshots.push(ss);
        }
      }
    }
    var rawQuery = {
      query: {
        query_string: {
          query: response._id,
          fields: ["_id"],
        },
      },
    };
    var hidrate = {
      hydrate: true,
      hydrateOptions: { lean: true },
      hydrateWithESResults: { source: true },
    };
    /*
    await ResponseModel.esSearch(rawQuery, hidrate).then(function (results) {
      console.log(JSON.stringify(results, null, " "));
      if (results.hits) {
        if (results.hits.hits) {
          es.push(results.hits.hits[0]);
        }
      }
    });
    */
  }

  res.render("remove", {
    payloads,
    responses,
    //es,
    webpages,
    screenshots,
  });
};
