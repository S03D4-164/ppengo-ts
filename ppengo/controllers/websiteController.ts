import { Request, Response } from "express";
import paginate from "express-paginate";

import WebsiteModel from "../models/website";
import WebpageModel from "../models/webpage";
import TagModel from "../models/tag";

import { Parser } from "@json2csv/plainjs";

//router.get("/", async (req: Request, res: Response) => {
export const getWebsites = async (
  req: Request,
  res: Response
): Promise<void> => {
  const user: any = req.user;
  if (!user) {
    return res.redirect(req.baseUrl + "/auth/");
  }

  const search: Record<string, any>[] = [];
  if (!user.admin) {
    search.push({ group: { $in: user.group } });
  }

  let elem: Record<string, any> | undefined;

  if (req.query.tagkey && typeof req.query.tagkey === "string") {
    elem = { [req.query.tagkey]: { $regex: "^.*$" } };
    if (req.query.tagval && typeof req.query.tagval === "string") {
      elem[req.query.tagkey] = req.query.tagval;
    }
    search.push({ tag: { $elemMatch: elem } });
  }

  if (req.query.url && typeof req.query.url === "string") {
    search.push({ url: req.query.url });
  }

  if (req.query.rurl && typeof req.query.rurl === "string") {
    search.push({
      url: new RegExp(req.query.rurl.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&")),
    });
  }

  if (req.query.track) {
    search.push({ "track.counter": { $gt: 0 } });
  }

  if (req.query.gsb && typeof req.query.gsb === "string") {
    elem = { threatType: new RegExp(req.query.gsb, "i") };
    search.push({ "gsb.lookup.matches": { $elemMatch: elem } });
  }

  if (req.query.csv) {
    const find = search.length
      ? WebsiteModel.find().and(search)
      : WebsiteModel.find();
    const websites = await find.sort("-createdAt").populate("last").exec();

    const fields = ["createdAt", "updatedAt", "url", "tag", "gsb.lookup"];
    const opts = { withBOM: true, fields };
    const parser = new Parser(opts);
    const csv = parser.parse(websites);

    res.setHeader("Content-disposition", "attachment; filename=websites.csv");
    res.setHeader("Content-Type", "text/csv; charset=UTF-8");
    res.send(csv);
  } else {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const query = search.length ? { $and: search } : {};
    const result = await WebsiteModel.paginate(query, {
      sort: { updatedAt: -1 },
      populate: "last",
      page,
      limit,
    });
    let pages: any = paginate.getArrayPages(req)(5, result.totalPages, page);
    if (page === 1) {
      for (let pg of pages) {
        if (pg.url.match(/page=NaN$/)) {
          pg.url = pg.url.replace(/page=NaN$/, `page=${pg.number}`);
        }
      }
    }
    res.render("websites", {
      title: "Sites",
      result,
      pages,
      search: req.query,
    });
  }
};

async function paginatedPage(
  query: Record<string, any>,
  req: Request
): Promise<any> {
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 10;
  const pages = await WebpageModel.paginate(query, {
    sort: { createdAt: -1 },
    page,
    limit,
  });
  return pages;
}

//router.get("/:id", async (req: Request, res: Response) => {
export const getWebsite = async (
  req: Request,
  res: Response
): Promise<void> => {
  const id = req.params.id;
  const verbose = !!req.query.verbose;

  const website = await WebsiteModel.findById(id).catch((error) => {
    res.render("error", { error });
  });

  const tag = await TagModel.find().sort({ key: 1, value: 1 });
  const search: Record<string, any>[] = [];

  if (req.query.rurl && typeof req.query.rurl === "string") {
    search.push({ url: new RegExp(req.query.rurl) });
  }

  if (req.query.source && typeof req.query.source === "string") {
    search.push({ content: new RegExp(req.query.source) });
  }

  if (req.query.status && typeof req.query.status === "string") {
    search.push({ $where: `/${req.query.status}/.test(this.status)` });
  }

  const query = search.length
    ? { input: website?.url, $and: search }
    : { input: website?.url };

  const result = await paginatedPage(query, req);
  const pages = result
    ? paginate.getArrayPages(req)(5, result.totalPages, result.page)
    : undefined;

  if (req.query.rmtag) {
    let rmtag: any = req.query.rmtag;
    const [key, ...valueParts] = rmtag.split(":");
    const value = valueParts.join(":");
    const remove = { [key]: value };

    website?.tag.forEach((tag, index) => {
      if (JSON.stringify(tag) === JSON.stringify(remove)) {
        website.tag.splice(index, 1);
        website.save();
      }
    });
  }

  res.render("website", {
    website,
    webpages: result,
    title: "Results",
    search: req.query,
    verbose,
    tag,
    result,
    pages,
  });
};

//router.post("/:id", async (req: Request, res: Response) => {
export const postWebsite = async (
  req: Request,
  res: Response
): Promise<void> => {
  const id = req.params.id;
  const website = await WebsiteModel.findById(id);

  let tag: Record<string, string> | undefined;

  if (req.body["tag"]) {
    const foundTag = await TagModel.findById(req.body["tag"]);
    if (foundTag) {
      tag = { [foundTag.key]: foundTag.value };
    }
  } else if (req.body["tagkey"] && req.body["tagval"]) {
    const foundTag = await TagModel.find({
      key: req.body["tagkey"],
      value: req.body["tagval"],
    });

    if (foundTag.length === 0) {
      tag = { [req.body["tagkey"]]: req.body["tagval"] };
      const newTag = new TagModel({
        key: req.body["tagkey"],
        value: req.body["tagval"],
      });
      await newTag.save();
    }
  }

  if (tag && !JSON.stringify(website?.tag).includes(JSON.stringify(tag))) {
    website?.tag.push(tag);
  }

  if (req.body["counter"]) {
    const track = {
      counter: req.body["counter"],
      period: req.body["period"],
      option: {
        referer: req.body["referer"],
        proxy: req.body["proxy"],
        timeout: req.body["timeout"],
        delay: req.body["delay"],
        exHeaders: req.body["exHeaders"],
        lang: req.body["lang"],
        userAgent: req.body["userAgent"],
      },
    };
    website!.track = track;
  }

  await website?.save();

  const result = await paginatedPage({ input: website?.url }, req);
  const pages = paginate.getArrayPages(req)(5, result.totalPages, result.page);

  const tagList = await TagModel.find().sort({ key: 1, value: 1 });

  res.render("website", {
    website,
    webpages: result,
    result,
    pages,
    title: "Results",
    tag: tagList,
    search: "",
  });
};
