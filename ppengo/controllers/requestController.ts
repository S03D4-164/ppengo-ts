import { Request, Response } from "express";
import RequestModel from "../models/request";
import logger from "../utils/logger";

// GET / - Fetch and render the latest 100 requests
//router.get("/", async (req: Request, res: Response): Promise<void> => {
export const getRequests = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const webpages = await RequestModel.find()
      .sort("-createdAt")
      .limit(100)
      .lean();
    res.render("requests", {
      title: "Request",
      webpages,
      // csrfToken: req.csrfToken(), // Uncomment if CSRF protection is used
    });
  } catch (error) {
    const err = error as Error;
    logger.error(err);
    res.status(500).send(err.message);
  }
};

// GET /:id - Fetch and render a specific request by ID
//router.get("/:id", async (req: Request, res: Response): Promise<void> => {
export const getRequest = async (
  req: Request,
  res: Response
): Promise<void> => {
  const id = req.params.id;
  try {
    const webpage = await RequestModel.findById(id)
      .populate("response")
      .populate("webpage")
      .lean();

    if (!webpage) {
      res.status(404).send("Request not found");
      return;
    }

    res.render("response", {
      title: "Request",
      request: webpage,
      webpage: webpage.webpage,
      response: webpage.response,
      // csrfToken: req.csrfToken(), // Uncomment if CSRF protection is used
    });
  } catch (error) {
    const err = error as Error;
    logger.error(err);
    res.status(500).send(err.message);
  }
};
