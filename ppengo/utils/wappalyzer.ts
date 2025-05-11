import {
  Wappalyzer as WappalyzerCore,
  technologies,
  categories,
} from "./wapalyzer-core";
import * as path from "node:path";
import * as fs from "fs";
import WebpageModel from "../models/webpage";
import ResponseModel from "../models/response";
import logger from "./logger";

export const wappalyze = async (
  url: string,
  headers: any,
  html: string,
  cookies: any
) => {
  let result: any;
  let wacategories = {};
  let watechnologies = {};
  try {
    wacategories = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, `./webappanalyzer/src/categories.json`),
        "utf-8"
      )
    );

    for (const index of Array(27).keys()) {
      const character = index ? String.fromCharCode(index + 96) : "_";
      watechnologies = {
        ...watechnologies,
        ...JSON.parse(
          fs.readFileSync(
            path.resolve(
              __dirname,
              `./webappanalyzer/src/technologies/${character}.json`
            ),
            "utf-8"
          )
        ),
      };
    }

    WappalyzerCore.setTechnologies(
      watechnologies ? watechnologies : technologies
    );
    WappalyzerCore.setCategories(wacategories ? wacategories : categories);

    const detections = await WappalyzerCore.analyze({
      url: url,
      headers: headers,
      cookies: cookies,
      html: html,
    });

    result = WappalyzerCore.resolve(detections);
  } catch (error: any) {
    console.error("Error analyzing website:", error);
  }
  return result;
};

export const analyze = async (id: string): Promise<void> => {
  logger.debug(`wappalyze ${id}`);
  const webpage = await WebpageModel.findById(id);

  if (webpage && webpage.url) {
    try {
      logger.debug(`page: ${webpage.url}`);
      const wapps = await wappalyze(
        webpage.url,
        webpage.headers || {},
        webpage.content || "",
        webpage.status || 0
      );

      if (wapps.length > 0) {
        await WebpageModel.findOneAndUpdate(
          { _id: webpage._id },
          { wappalyzer: wapps }
        );
      }
    } catch (err) {
      logger.error(err);
    }
  }

  const newResponses: any = [];
  const responses = await ResponseModel.find({ webpage: id });

  for (const response of responses) {
    if (response.url) {
      try {
        const wapps = await wappalyze(
          response.url,
          response.headers || {},
          response.text || "",
          response.status || 0
        );

        if (wapps.length > 0) {
          response.wappalyzer = wapps;
          newResponses.push(response);
        }
      } catch (err) {
        logger.error(err);
      }
    }
  }

  await ResponseModel.bulkSave(newResponses);
};
