import { createPagesFunctionHandler } from "@react-router/cloudflare";
import * as build from "./_server";

// @ts-ignore
export const onRequest = createPagesFunctionHandler({ build: build as any });
