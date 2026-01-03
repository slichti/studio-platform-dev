import { createRequestHandler } from "@react-router/cloudflare";
// @ts-ignore - The build file is generated at build time
import * as build from "../build/server/index.js";

export const onRequest = createRequestHandler({ build });
