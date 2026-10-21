/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router } from "express";
import { authRoutes } from "../modules/auth/auth.route";
import { projectRoutes } from "../modules/project/project.route";
import { userRoutes } from "../modules/user/user.route";

export const router = Router();

interface IModuleRoutes {
  path: string;
  route: any;
}

const moduleRoutes: IModuleRoutes[] = [
  {
    path: "/auth",
    route: authRoutes,
  },
  {
    path: "/projects",
    route: projectRoutes,
  },
  {
    path: "/users",
    route: userRoutes,
  },
];

moduleRoutes.forEach((route) => {
  router.use(route.path, route.route);
});