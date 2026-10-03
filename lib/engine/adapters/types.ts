import type { Shot, TokenGroup } from "../types";

export interface AdapterOutput {
  prompt: string;
  reads: string[]; // every value path placed in the prompt, e.g. "look/overgrown-interior.light"
}

export interface Adapter {
  id: "image-gen" | "seedance";
  target: { model: string }; // model names live only in adapter files
  // `groups` are the shot's resolved refs, in ref order. Never prim groups.
  compose(shot: Shot, groups: TokenGroup[]): AdapterOutput;
}
