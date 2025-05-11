import { Request, Response, NextFunction } from "express";
import UserModel from "../models/user";
import { IUser } from "../models/user";

export const getAuth = (req: Request, res: Response): void => {
  res.render("auth", {
    user: req.user,
  });
};

//router.post("/user/:username", async (req: Request, res: Response) => {
export const postUsername = async (
  req: Request,
  res: Response
): Promise<void> => {
  const reqUser = req.user as IUser | undefined;
  const loginUser = await UserModel.findById(reqUser?._id);
  if (loginUser?.admin || loginUser?.username === req.params.username) {
    const user = await UserModel.findOne({ username: req.params.username });
    if (user) {
      await user.setPassword(req.body.password);
      await user.save();
      return res.render("auth", {
        user: user,
        message: "Password changed.",
      });
    }
  }
  res.render("auth", {
    user: req.user,
    message: "No permission.",
  });
};

//router.get("/user/:username", async (req: Request, res: Response) => {
export const getUsername = async (
  req: Request,
  res: Response
): Promise<void> => {
  const reqUser = req.user as IUser | undefined;
  const loginUser = await UserModel.findById(reqUser?._id);
  if (loginUser?.admin || loginUser?.username === req.params.username) {
    const user = await UserModel.findOne({ username: req.params.username });
    if (user) {
      console.log(user);
      return res.render("auth", {
        user: user,
      });
    }
  }
  res.render("auth", {
    user: req.user,
    message: "No permission.",
  });
};

//router.get("/register", (req: Request, res: Response) => {
export const getRegister = (req: Request, res: Response): void => {
  res.render("register", {});
};

//router.post("/register", async (req: Request, res: Response) => {
export const postRegister = async (
  req: Request,
  res: Response
): Promise<void> => {
  const user = req.user as IUser | undefined;
  if (user && !user.admin) {
    return res.render("auth", {
      user: req.user,
      message: "No permission.",
    });
  } else if (!user) {
    const existingUsers = await UserModel.find();
    if (existingUsers.length > 0) {
      return res.render("auth", {
        user: req.user,
        message: "No permission.",
      });
    }
  }
  const { username, password } = req.body;
  UserModel.register(
    new UserModel({ username: username, group: [username] }),
    password,
    (err, account) => {
      if (err) {
        console.log(err);
        return res.render("register", { account: account });
      }
      res.render("auth", {
        user: req.user,
        message: `Registered: ${account.username}`,
      });
    }
  );
};

//router.post("/", passport.authenticate("local"), (req: Request, res: Response) => {
export const postAuth = (req: Request, res: Response): void => {
  //res.redirect(req.baseUrl + "/../");
  res.redirect(req.baseUrl);
};

//router.get("/logout", (req: Request, res: Response, next: NextFunction) => {
export const logout = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.redirect(req.baseUrl);
  });
};
