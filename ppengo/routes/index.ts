import express, { Router } from "express";
import passport from "passport";

const router: Router = express.Router();

import * as auth from "../controllers/authController";
router.get("/auth", auth.getAuth);
router.post("/auth", passport.authenticate("local"), auth.postAuth);
router.get("/auth/register", auth.getRegister);
router.post("/auth/register", auth.postRegister);
router.get("/user", auth.getUsername);
router.post("/user", auth.postUsername);
router.get("/logout", auth.logout);

import { screenshot, screenshots } from "../controllers/screenshotController";
router.get("/screenshot", screenshots);
router.get("/screenshot/:id", screenshot);

import { getRequest, getRequests } from "../controllers/requestController";
router.get("/request", getRequests);
router.get("/request/:id", getRequest);

import { getResponse, getResponses } from "../controllers/responseController";
router.get("/response", getResponses);
router.get("/response/:id", getResponse);

import { getWebpage, getWebpages } from "../controllers/webpageController";
router.get("/page", getWebpages);
router.get("/page/:id", getWebpage);

import {
  getPayload,
  getPayloads,
  downloadPayload,
} from "../controllers/payloadController";
router.get("/payload", getPayloads);
router.get("/payload/:id", getPayload);
router.get("/payload/download/:id", downloadPayload);

import {
  getYararule,
  getYararules,
  postYararule,
  postYararules,
} from "../controllers/yararuleController";
router.get("/yararule", getYararules);
router.get("/yararule/:id", getYararule);
router.post("/yararule", postYararules);
router.post("/yararule/:id", postYararule);

import { postWgeteer, postProgress } from "../controllers/wgeteerController";
router.post("/", postWgeteer);
router.post("/progress", postProgress);

import {
  getWebsite,
  getWebsites,
  postWebsite,
} from "../controllers/websiteController";
router.get("/website", getWebsites);
router.get("/website/:id", getWebsite);
router.post("/website/:id", postWebsite);
router.get("/", getWebsites);

export default router;
