import "./polyfill";
import { createRequestHandler } from "@react-router/cloudflare";
// @ts-ignore
import * as build from "./build/server/index.js";

const handler = createRequestHandler({ build });

export default {
    fetch: (request: Request, env: any, ctx: any) => {
        return handler(request, {
            cloudflare: { env, ctx }
        });
    }
};
