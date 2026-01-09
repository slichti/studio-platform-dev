import { createRequestHandler } from "@react-router/cloudflare";
// @ts-ignore - The build file is generated at build time
import * as build from "./_server.js";

export const onRequest = createRequestHandler({ build: build as any });
