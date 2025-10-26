import express, { Request, Response } from "express";
import paginate from "express-paginate";
import WebsiteModel from "../models/website";
import UserModel from "../models/user";
import WebpageModel from "../models/webpage";
import agenda from "../services/agenda";
import bulkregister from "../utils/bulkregister";

const router = express.Router();

router.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

router.get("/webpage", async (req: Request, res: Response) => {
  const user: any = req.user;
  if (!user) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const search: Record<string, any>[] = [];
  if (!user.admin) {
    //search.push({ group: { $in: user.group } });
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

  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 10;
  const query = search.length ? { $and: search } : {};
  const result = await (WebpageModel as any).paginate(query, {
    sort: { updatedAt: -1 },
    populate: "screenshot",
    page,
    limit,
  });

  res.json(result);
});

router.get("/webpage/:id", async (req: Request, res: Response) => {
  const user: any = req.user;
  if (!user) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const webpage = await WebpageModel.findById(req.params.id).populate("last");
  if (!webpage) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json(webpage);
});

router.get("/website", async (req: Request, res: Response) => {
  const user: any = req.user;
  if (!user) {
    res.status(401).json({ error: "unauthorized" });
    return;
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

  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 10;
  const query = search.length ? { $and: search } : {};
  const result = await (WebsiteModel as any).paginate(query, {
    sort: { updatedAt: -1 },
    populate: "last",
    page,
    limit,
  });
  res.json(result);
});

router.get("/website/:id", async (req: Request, res: Response) => {
  const user: any = req.user;
  if (!user) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const website = await WebsiteModel.findById(req.params.id).populate("last");
  if (!website) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json(website);
});

// current user info
router.get("/user", async (req: Request, res: Response) => {
  const user: any = req.user;
  if (!user) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  // minimize fields
  res.json({
    _id: user._id,
    username: user.username,
    admin: !!user.admin,
    group: user.group,
  });
});

// register: first user can self-register, otherwise admin only
router.post("/auth/register", async (req: Request, res: Response) => {
  try {
    const loginUser: any = req.user;
    if (loginUser && !loginUser.admin) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    if (!loginUser) {
      const existingUsers = await UserModel.find();
      if (existingUsers.length > 0) {
        res.status(403).json({ error: "forbidden" });
        return;
      }
    }

    const { username, password } = req.body || {};
    if (!username || !password) {
      res.status(400).json({ error: "username_password_required" });
      return;
    }
    // register via passport-local-mongoose
    UserModel.register(
      new UserModel({ username, group: [username] }),
      password,
      (err: any, account: any) => {
        if (err) {
          res.status(400).json({
            error: "register_failed",
            detail: String((err && err.message) || err),
          });
          return;
        }
        res.json({ ok: true, username: account.username });
      }
    );
  } catch (e: any) {
    res
      .status(500)
      .json({ error: "internal_error", detail: String((e && e.message) || e) });
  }
});

// register URLs for wgeteer/playwget
router.post("/wgeteer", async (req: Request, res: Response) => {
  try {
    const input: string = req.body?.url;
    if (!input || typeof input !== "string") {
      res.status(400).json({ error: "url_required" });
      return;
    }

    const urls: { url: string; option: any }[] = [];
    // split by newline (CRLF/LF) or commas, trim and skip blanks
    const lines = input
      .split(/[\r\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const inputUrl of lines) {
      const ex = /(https?|ftp):\/\/.+/;
      const match = ex.exec(inputUrl);
      if (match) {
        const validUrl = match[0];
        let lang: any = req.body.lang;
        if (typeof lang === "string") lang = [lang];
        let userAgent: any = req.body.userAgent;
        if (typeof userAgent === "string") userAgent = [userAgent];

        const langs =
          lang && Array.isArray(lang) && lang.length ? lang : [undefined];
        const uas =
          userAgent && Array.isArray(userAgent) && userAgent.length
            ? userAgent
            : [undefined];
        for (const lkey of langs) {
          for (const ukey of uas) {
            const option: any = {
              timeout: req.body.timeout || 30,
              delay: req.body.delay || 5,
            };
            if (lkey) option.lang = lkey;
            if (ukey) option.userAgent = ukey;
            if (req.body.referer) option.referer = req.body.referer;
            if (req.body.proxy) option.proxy = req.body.proxy;
            if (typeof req.body.click !== "undefined")
              option.click = !!req.body.click;
            if (req.body.exHeaders) option.exHeaders = req.body.exHeaders;
            if (typeof req.body.disableScript !== "undefined")
              option.disableScript = !!req.body.disableScript;
            if (typeof req.body.pptr !== "undefined")
              option.pptr = !!req.body.pptr;
            urls.push({ url: validUrl, option });
          }
        }
      }
    }

    if (!urls.length) {
      res.status(400).json({ error: "no_valid_urls" });
      return;
    }

    const track = req.body.track || 0;
    const user: any = req.user;
    const webpages: any[] = await (bulkregister as any)(urls, track, user);
    const ids: string[] = webpages.map((w: any) => String(w._id));

    for (const webpage of webpages) {
      await (agenda as any).now("playwget", { pageId: webpage._id, count: 0 });
    }

    res.json({ ok: true, ids, count: ids.length });
  } catch (e: any) {
    res
      .status(500)
      .json({ error: "internal_error", detail: String((e && e.message) || e) });
  }
});

// check progress by ids
router.post("/progress", async (req: Request, res: Response) => {
  try {
    const ids = (req.body && (req.body["pageId[]"] || req.body.ids)) as
      | string[]
      | string;
    const idArray: string[] = Array.isArray(ids)
      ? ids
      : typeof ids === "string"
        ? ids.split(",")
        : [];
    if (!idArray.length) {
      res.status(400).json({ error: "invalid_ids" });
      return;
    }
    const pages: any[] = await (WebpageModel as any)
      .where("_id")
      .in(idArray)
      .populate("screenshot")
      .lean();
    let completed = true;
    const webpages = pages.map((p: any) => {
      const done = (p.requests && p.requests.length) || p.error;
      if (!done) completed = false;
      return {
        _id: String(p._id),
        error: !!p.error,
        requestsCount: Array.isArray(p.requests) ? p.requests.length : 0,
        screenshotId:
          p.screenshot && p.screenshot._id
            ? String(p.screenshot._id)
            : undefined,
      };
    });
    res.json({ completed, webpages });
  } catch (e: any) {
    res
      .status(500)
      .json({ error: "internal_error", detail: String((e && e.message) || e) });
  }
});

// stream screenshot image via API
router.get("/screenshot/:id", async (req: Request, res: Response) => {
  try {
    const { default: Screenshot } = await import("../models/screenshot");
    const sc: any = await (Screenshot as any).findById(req.params.id).lean();
    if (!sc || !sc.screenshot) {
      res.status(404).send("Screenshot not found");
      return;
    }
    const img = Buffer.from(sc.screenshot, "base64");
    res.writeHead(200, {
      "Content-Type": "image/png",
      "Content-Length": img.length,
    });
    res.end(img);
  } catch (e: any) {
    res.status(500).send("Internal error");
  }
});

export default router;
