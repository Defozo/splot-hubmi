import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { serveStatic } from "./staticSite";
const http = httpRouter();
auth.addHttpRoutes(http);
http.route({ pathPrefix: "/", method: "GET", handler: serveStatic });
export default http;
