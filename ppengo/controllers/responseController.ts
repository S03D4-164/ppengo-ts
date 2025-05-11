import { Request, Response } from "express";
import ResponseModel from "../models/response";
import paginate from "express-paginate";
import { Parser } from "@json2csv/plainjs";
import moment from "moment";
import { createPatch } from "diff";
import logger from "../utils/logger";

// GET / - Search and render responses
//router.get("/", async (req: Request, res: Response): Promise<void> => {
export const getResponses = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const search: any[] = [];

    if (req.query.url) search.push({ url: req.query.url });
    if (req.query.rurl)
      search.push({ url: new RegExp(req.query.rurl as string) });
    if (req.query.source)
      search.push({ text: new RegExp(req.query.source as string) });
    if (req.query.ip)
      search.push({ "remoteAddress.ip": new RegExp(req.query.ip as string) });
    if (req.query.country) {
      search.push({
        "remoteAddress.geoip.country": new RegExp(req.query.country as string),
      });
    }
    if (req.query.status) search.push({ status: req.query.status });
    if (req.query.payload) search.push({ payload: req.query.payload });

    if (req.query.start) {
      const start = moment(req.query.start as string).toDate();
      if (!isNaN(start.getTime())) search.push({ createdAt: { $gte: start } });
    }

    if (req.query.end) {
      const end = moment(req.query.end as string)
        .add(1, "days")
        .toDate();
      if (!isNaN(end.getTime())) search.push({ createdAt: { $lte: end } });
    }

    logger.debug(search);

    if (req.query.csv) {
      const responses = await ResponseModel.find()
        .and(search)
        .lean()
        .sort("-createdAt");
      const fields = [
        "createdAt",
        "url",
        "status",
        "remoteAddress.ip",
        "remoteAddress.reverse",
        "remoteAddress.geoip",
        "wappalyzer",
        "securityDetails.issuer",
        "securityDetails.validFrom",
        "securityDetails.validTo",
      ];
      const parser = new Parser({ withBOM: true, fields });
      const csv = parser.parse(responses);

      res.setHeader(
        "Content-disposition",
        "attachment; filename=responses.csv"
      );
      res.setHeader("Content-Type", "text/csv; charset=UTF-8");
      res.send(csv);
    } else {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 10;
      const now = moment().toDate();
      if (search.length === 0) search.push({ createdAt: { $lte: now } });
      const query: any = { $and: search };
      const result = await ResponseModel.paginate(query, {
        sort: { createdAt: -1 },
        page,
        limit,
        lean: true,
      });
      let pages: any = paginate.getArrayPages(req)(5, result.totalPages, page);
      if (page === 1) {
        for (let pg of pages) {
          if (pg.url.match(/page=NaN$/)) {
            pg.url = pg.url.replace(/page=NaN$/, `page=${pg.number}`);
          }
        }
      }
      let firstpage, lastpage;
      for (let pg of pages) {
        if (pg.number === page) {
          const before = `page=${pg.number}`;
          firstpage = pg.url.replace(new RegExp(before, "g"), "page=1");
          lastpage = pg.url.replace(
            new RegExp(before, "g"),
            `page=${result.totalPages}`
          );
        }
      }
      console.log(result, pages);
      res.render("responses", {
        title: "Responses",
        search: req.query,
        result,
        pages,
        firstpage,
        lastpage,
      });
    }
  } catch (err) {
    logger.error(err);
    res.status(500).send("Error occurred while fetching responses.");
  }
};

//router.get("/:id", async function (req: Request, res: Response) {
export const getResponse = async (
  req: Request,
  res: Response
): Promise<void> => {
  const id = req.params.id;
  const response: any = await ResponseModel.findById(id)
    .populate("request")
    .populate("webpage")
    .then((document) => {
      return document;
    });
  const webpage = response.webpage;
  const request = response.request;

  let previous: any, diff;
  if (response.text) {
    previous = await ResponseModel.find({
      url: response.url,
      createdAt: { $lt: response.createdAt },
    })
      .lean()
      .sort("-createdAt")
      .then((document) => {
        logger.debug(document.length);
        return document;
      });
    if (previous.length) {
      previous = previous[0];
      if (previous.text && response.text) {
        diff = createPatch(
          "",
          previous.text,
          response.text,
          previous._id,
          response._id
        );
      }
    }
  }

  res.render("response", {
    title: "Response",
    webpage: webpage,
    request: request,
    response: response,
    previous,
    diff,
  });
};

//router.get("/remove/:id", async function (req: Request, res: Response) {
export const rmRequest = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const response: any = await ResponseModel.findById(id)
    .populate("webpage")
    .populate("payload")
    .then((document) => {
      return document;
    });
  const webpage = response.webpage;
  const payload = response.payload;
  const rawQuery = {
    query: {
      query_string: {
        query: id,
        fields: ["_id"],
      },
    },
  };
  logger.debug(rawQuery);
  const hydrateOptions = {
    hydrate: true,
    hydrateOptions: { lean: true },
    hydrateWithESResults: { source: true },
  };
  /*const es = await ResponseModel.esSearch(
    rawQuery,
    hydrateOptions,
    function (err, results) {
      let result;
      if (results) {
        result = results.hits ? results.hits.hits : [];
      }
      return result;
    },
  );*/
  res.render("remove", {
    webpages: [webpage],
    responses: [response],
    payloads: [payload],
    //es: es,
  });
};
