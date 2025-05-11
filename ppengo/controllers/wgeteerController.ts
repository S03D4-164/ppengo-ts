import { Request, Response } from "express";
import Webpage from "../models/webpage";
import agenda from "../services/agenda";
import bulkregister from "../utils/bulkregister";

// Define interfaces for request body and options
interface RequestBody {
  url: string;
  lang?: string | string[];
  userAgent?: string | string[];
  timeout?: number;
  delay?: number;
  referer?: string;
  proxy?: string;
  click?: boolean;
  exHeaders?: Record<string, string>;
  disableScript?: boolean;
  pptr?: boolean;
  track?: number;
}

interface UrlOption {
  timeout: number;
  delay: number;
  lang?: string;
  userAgent?: string;
  referer?: string;
  proxy?: string;
  click?: boolean;
  exHeaders?: Record<string, string>;
  disableScript?: boolean;
  pptr?: boolean;
}

//router.post("/", async (req: Request<{}, {}, RequestBody>, res: Response) => {
export const postWgeteer = async (
  req: Request,
  res: Response
): Promise<void> => {
  const input = req.body.url;

  if (!input) {
    res.status(400).send("URL is required.");
  }

  const urls: { url: string; option: UrlOption }[] = [];
  for (const inputUrl of input.split("\r\n")) {
    const ex = /(https?|ftp):\/\/.+/;
    const match = ex.exec(inputUrl);
    if (match) {
      const validUrl = match[0];
      console.log(validUrl);

      let lang = req.body.lang;
      if (typeof lang === "string") lang = [lang];

      let userAgent = req.body.userAgent;
      if (typeof userAgent === "string") userAgent = [userAgent];

      for (const lkey of lang || []) {
        for (const ukey of userAgent || []) {
          const option: UrlOption = {
            timeout: req.body.timeout || 30,
            delay: req.body.delay || 5,
            lang: lkey,
            userAgent: ukey,
          };

          if (req.body.referer) option.referer = req.body.referer;
          if (req.body.proxy) option.proxy = req.body.proxy;
          if (req.body.click) option.click = req.body.click;
          if (req.body.exHeaders) option.exHeaders = req.body.exHeaders;
          if ("disableScript" in req.body) option.disableScript = true;
          if ("pptr" in req.body) option.pptr = req.body.pptr;

          urls.push({
            url: validUrl,
            option,
          });
        }
      }
    }
  }

  const track = req.body.track || 0;
  const user: any = req.user;
  const webpages = await bulkregister(urls, track, user);
  const ids: string[] = webpages.map((webpage: any) => webpage._id.toString());

  for (const webpage of webpages) {
    agenda.now("wgeteer", {
      pageId: webpage._id,
      count: 0,
    });
  }

  res.render("progress", {
    title: "Progress",
    webpages,
    ids: ids.join(","),
    search: null,
  });
};

//router.post("/progress", (req: Request, res: Response) => {
export const postProgress = async (
  req: Request,
  res: Response
): Promise<void> => {
  const ids = req.body["pageId[]"];
  if (ids) {
    Webpage.where("_id")
      .in(ids)
      .then((webpages: any[]) => {
        let completed = true;
        for (const webpage of webpages) {
          if (!webpage.requests.length && !webpage.error) {
            completed = false;
          }
        }
        res.render("progress", {
          webpages,
          title: "Progress",
          completed,
          ids,
          search: null,
        });
      })
      .catch((err: Error) => {
        res.status(500).send(err.message);
      });
  } else {
    res.status(400).send("Invalid page IDs.");
  }
};
