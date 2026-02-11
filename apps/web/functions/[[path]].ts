import { createPagesFunctionHandler } from "@react-router/cloudflare";
import * as build from "./_server";

export const onRequest = createPagesFunctionHandler({ build });
