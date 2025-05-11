import { Request, Response } from "express";
import Screenshot from "../models/screenshot";

export const screenshots = (req: Request, res: Response): void => {
  Screenshot.find()
    .lean()
    .sort("-createdAt")
    .limit(100)
    .then((payloads) => {
      res.render("screenshots", {
        title: "Screenshot",
        payloads,
      });
    })
    .catch((err: Error) => {
      res.status(500).send(err.message);
    });
};

export const screenshot = (req: Request, res: Response): void => {
  const id = req.params.id;

  Screenshot.findById(id)
    .lean()
    .then((webpage: any) => {
      if (!webpage || !webpage.screenshot) {
        res.status(404).send("Screenshot not found");
        return;
      }

      const img = Buffer.from(webpage.screenshot, "base64");
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Content-Length": img.length,
      });
      res.end(img);
    })
    .catch((err: Error) => {
      res.status(500).send(err.message);
    });
};