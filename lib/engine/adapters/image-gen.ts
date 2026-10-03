import type { Adapter } from "./types";

// [HAND] Nick writes compose() with no agent. Rule and tests: plan Task 10.
export const imageGen: Adapter = {
  id: "image-gen",
  target: { model: "gen4_image" },
  compose() {
    throw new Error("image-gen compose() is the [HAND] task in plan Task 10");
  },
};
