import { Request, Response } from "express";
import paginate from "express-paginate";
import { Parser } from "@json2csv/plainjs";
import { createPatch } from "diff";

import WebpageModel from "../models/webpage";
import WebsiteModel from "../models/website";
import RequestModel from "../models/request";
import HarfileModel from "../models/harfile";

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

//router.get("/", async (req: Request, res: Response) => {
export const getWebpages = async (
  req: Request,
  res: Response
): Promise<void> => {
  const search: Record<string, any>[] = [];

  if (req.query.input) {
    search.push({ input: req.query.input });
  }
  if (req.query.rinput) {
    const escapedInput = escapeRegExp(req.query.rinput as string);
    search.push({
      input: new RegExp(escapedInput),
    });
  }
  if (req.query.title) {
    search.push({ title: new RegExp(req.query.title as string) });
  }
  if (req.query.url) {
    search.push({ url: req.query.url });
  }
  if (req.query.rurl) {
    search.push({
      url: new RegExp(
        (req.query.rurl as string).replace(/[\\^$.*+?()[\]{}|]/g, "\\$&")
      ),
    });
  }
  if (req.query.source) {
    search.push({ content: new RegExp(req.query.source as string) });
  }
  if (req.query.ip) {
    search.push({ "remoteAddress.ip": new RegExp(req.query.ip as string) });
  }
  if (req.query.country) {
    search.push({
      "remoteAddress.geoip.country": new RegExp(req.query.country as string),
    });
  }
  if (req.query.status) {
    search.push({ status: req.query.status });
  }

  const verbose = req.query.verbose ? true : false;

  if (req.query.csv) {
    let find = WebpageModel.find();
    if (search.length) find = find.and(search);
    const webpages = await find.sort("-createdAt").exec();

    const fields = [
      "createdAt",
      "input",
      "title",
      "error",
      "status",
      "remoteAddress.ip",
      "remoteAddress.reverse",
      "remoteAddress.geoip",
      "wappalyzer",
      "securityDetails.issuer",
      "securityDetails.validFrom",
      "securityDetails.validTo",
      "url",
    ];
    const opts = { withBOM: true, fields };
    const parser = new Parser(opts);
    const csv = parser.parse(webpages);

    res.setHeader("Content-disposition", "attachment; filename=webpages.csv");
    res.setHeader("Content-Type", "text/csv; charset=UTF-8");
    res.send(csv);
  } else {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const query = search.length ? { $and: search } : {};
    const result = await WebpageModel.paginate(query, {
      sort: { createdAt: -1 },
      page,
      limit,
      lean: true,
    });
    console.log(result);
    let pages: any = paginate.getArrayPages(req)(5, result.totalPages, page);
    if (page === 1) {
      for (let pg of pages) {
        if (pg.url.match(/page=NaN$/)) {
          pg.url = pg.url.replace(/page=NaN$/, `page=${pg.number}`);
        }
      }
    }
    res.render("pages", {
      title: "Pages",
      search: req.query,
      result,
      verbose,
      pages,
      //err,
    });
  }
};

//router.get("/:id", async (req: Request, res: Response) => {
export const getWebpage = async (
  req: Request,
  res: Response
): Promise<void> => {
  const id = req.params.id;
  const webpage = await WebpageModel.findById(id).exec();

  if (!webpage) {
    res.status(404).send("Webpage not found");
    return;
  }

  let previous: any;
  let diff: string | undefined;

  if (webpage.content) {
    const previousDocs = await WebpageModel.find({
      input: webpage.input,
      createdAt: { $lt: webpage.createdAt },
    })
      .sort("-createdAt")
      .lean()
      .exec();

    if (previousDocs.length) {
      previous = previousDocs[0];
      if (previous.content && webpage.content) {
        diff = createPatch(
          "",
          previous.content,
          webpage.content,
          previous._id.toString(),
          webpage._id.toString()
        );
      }
    }
  }

  const search: Record<string, any>[] = [];
  if (req.query.rurl) {
    search.push({ url: new RegExp(req.query.rurl as string) });
  }
  if (req.query.source) {
    search.push({ text: new RegExp(req.query.source as string) });
  }
  if (req.query.status) {
    search.push({ $where: `/${req.query.status}/.test(this.status)` });
  }

  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 10;
  const result = await RequestModel.paginate(
    { webpage: id },
    {
      sort: { createdAt: 1 },
      page,
      limit,
      lean: true,
      populate: {
        path: "response",
        select: "_id remoteAddress status securityDetails yara payload text",
      },
    }
  );

  const pages = paginate.getArrayPages(req)(5, result.totalPages, page);

  console.log(req.query, search);

  const website = await WebsiteModel.findOne({ url: webpage.input })
    .lean()
    .exec();

  const harfile = await HarfileModel.findOne({ webpage: webpage._id }).exec();
  let har;
  if (harfile) {
    har = Buffer.from(harfile.har).toString("utf-8");
  }

  res.render("page", {
    webpage,
    result,
    pages,
    website,
    previous,
    diff,
    har,
    search: req.query,
    title: "Request",
  });
};
