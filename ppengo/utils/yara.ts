import yara from "yara";
import WebpageModel from "../models/webpage";
import ResponseModel from "../models/response";
import PayloadModel from "../models/payload";
import YaraModel from "../models/yara";
import logger from "./logger";

interface YaraRule {
  rule: string;
}

interface YaraScanResult {
  rules: Array<{ id: string; tags: string[]; meta: Record<string, any> }>;
}

const yaraScan = async (source: string): Promise<YaraScanResult | null> => {
  return new Promise((resolve, reject) => {
    yara.initialize(async (error: Error | null) => {
      if (error) {
        logger.error(error.message);
        reject(null);
      } else {
        const scanner = yara.createScanner();

        try {
          const yararules = await YaraModel.find();
          const rules = yararules.map((yararule: any) => yararule.rule);
          const ruleString = rules.join("\n");

          const options = { rules: [{ string: ruleString }] };

          scanner.configure(options, (error: Error | null, warnings: any[]) => {
            if (error) {
              logger.error(error.message);
              reject(null);
            } else {
              if (warnings.length) {
                logger.debug("Compile warnings: " + JSON.stringify(warnings));
              }

              try {
                const buf = { buffer: Buffer.from(source, "utf-8") };
                scanner.scan(buf, (error: Error | null, result: YaraScanResult) => {
                  if (error) {
                    logger.error(`Scan failed: ${error.message}`);
                    reject(null);
                  } else {
                    if (result.rules.length) {
                      logger.debug(`Matched: ${JSON.stringify(result)}`);
                    }
                    resolve(result);
                  }
                });
              } catch (err) {
                logger.error(err);
                reject(null);
              }
            }
          });
        } catch (err) {
          logger.error(err);
          reject(null);
        }
      }
    });
  });
};

export const yaraPayload = async (id: string): Promise<void> => {
  logger.debug(`[yara] Payload ${id}`);
  const payload: any = await PayloadModel.findById(id);
  if (payload?.payload) {
    payload.yara = await yaraScan(payload.payload);
    await payload.save();
    logger.debug(payload.yara);
  } else {
    logger.debug("[yara] Payload is empty");
  }
};

export const yaraPage = async (id: string): Promise<void> => {
  const page = await WebpageModel.findById(id);
  if (page?.content) {
    logger.debug(`Page: ${page._id}, Content length: ${page.content.length}`);
    const yaraResult = await yaraScan(page.content);
    if (yaraResult?.rules.length) {
      await WebpageModel.findOneAndUpdate({ _id: page._id }, { yara: yaraResult });
    }
  }

  const responses = await ResponseModel.find({ webpage: id });
  const updatedResponses = [];

  for (const res of responses) {
    if (res.text) {
      const yaraResult = await yaraScan(res.text);
      if (yaraResult?.rules.length) {
        res.yara = yaraResult;
        updatedResponses.push(res);
      }
    }
  }

  await ResponseModel.bulkSave(updatedResponses);
};
