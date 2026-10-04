/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as assistance from "../assistance.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as demoReset from "../demoReset.js";
import type * as evaluation from "../evaluation.js";
import type * as fileActions from "../fileActions.js";
import type * as files from "../files.js";
import type * as grantTransactions from "../grantTransactions.js";
import type * as grants from "../grants.js";
import type * as http from "../http.js";
import type * as hub from "../hub.js";
import type * as importSupport from "../importSupport.js";
import type * as imports from "../imports.js";
import type * as jobs from "../jobs.js";
import type * as knowledge from "../knowledge.js";
import type * as lib_acl from "../lib/acl.js";
import type * as lib_ocr from "../lib/ocr.js";
import type * as matching from "../matching.js";
import type * as operations from "../operations.js";
import type * as privacy from "../privacy.js";
import type * as search from "../search.js";
import type * as seed from "../seed.js";
import type * as staticSite from "../staticSite.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  assistance: typeof assistance;
  auth: typeof auth;
  crons: typeof crons;
  demoReset: typeof demoReset;
  evaluation: typeof evaluation;
  fileActions: typeof fileActions;
  files: typeof files;
  grantTransactions: typeof grantTransactions;
  grants: typeof grants;
  http: typeof http;
  hub: typeof hub;
  importSupport: typeof importSupport;
  imports: typeof imports;
  jobs: typeof jobs;
  knowledge: typeof knowledge;
  "lib/acl": typeof lib_acl;
  "lib/ocr": typeof lib_ocr;
  matching: typeof matching;
  operations: typeof operations;
  privacy: typeof privacy;
  search: typeof search;
  seed: typeof seed;
  staticSite: typeof staticSite;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
