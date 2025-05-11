import { Request, Response } from "express";
import { Document } from "mongoose";
import paginate from "express-paginate";
import { Parser } from "@json2csv/plainjs";
import moment from "moment";
import YaraModel from "../models/yara";

// Define interfaces for the models
interface YaraDocument extends Document {
  name: string;
  rule: string;
  createdAt: Date;
}

//router.get("/", async (req: Request, res: Response) => {
export const getYararules = async (
  req: Request,
  res: Response
): Promise<void> => {
  const search: Record<string, any>[] = [];
  if (req.query.rule) {
    search.push({ rule: new RegExp(req.query.rule as string) });
  }

  if (req.query.csv) {
    let find = YaraModel.find();
    if (search.length) find = find.and(search);

    const payload = await find.lean().sort("-createdAt");
    const fields = ["createdAt", "name", "rule"];
    const opts = { withBOM: true, fields };
    const parser = new Parser(opts);
    const csv = parser.parse(payload);

    res.setHeader("Content-disposition", "attachment; filename=yararules.csv");
    res.setHeader("Content-Type", "text/csv; charset=UTF-8");
    res.send(csv);
  } else {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const now = moment().toDate();
    const query = search.length
      ? { $and: search }
      : { createdAt: { $lte: now } };

    const result = await YaraModel.paginate(query, {
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
    res.render("yararules", {
      title: "YARA rules",
      search: req.query,
      result,
      pages,
    });
  }
};

//router.get("/:id", async (req: Request, res: Response) => {
export const getYararule = async (
  req: Request,
  res: Response
): Promise<void> => {
  const id = req.params.id;
  const yara = (await YaraModel.findById(id)) as YaraDocument;

  if (!yara) {
    res.status(404).send({ error: "YARA rule not found" });
    return;
  }

  res.render("yararule", { yara });
};

//router.post("/:id", async (req: Request, res: Response) => {
export const postYararule = async (
  req: Request,
  res: Response
): Promise<void> => {
  const id = req.params.id;
  const yara = (await YaraModel.findById(id)) as YaraDocument;

  if (!yara) {
    res.status(404).send({ error: "YARA rule not found" });
    return;
  }

  let message: string;
  if (req.body.name && req.body.rule) {
    try {
      yara.name = req.body.name;
      yara.rule = req.body.rule;
      await yara.save();
      message = "Update succeeded.";
    } catch (err: any) {
      console.error(err);
      message = err.message;
    }
  } else {
    message = "Error: Invalid Data";
  }

  res.render("yararule", { yara, message });
};

//router.post("/", async (req: Request, res: Response) => {
export const postYararules = async (
  req: Request,
  res: Response
): Promise<void> => {
  let saveError: string | undefined;

  try {
    const newRule = new YaraModel({
      name: req.body.name,
      rule: req.body.rule,
    });
    await newRule.save();
  } catch (err: any) {
    saveError = err.message;
  }
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 10;
  const now = moment().toDate();
  const query = { createdAt: { $lte: now } };

  const result = await YaraModel.paginate(query, {
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
  res.render("yararules", {
    title: "YARA rules",
    error: saveError,
    result,
    pages,
  });
};
