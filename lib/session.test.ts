import { describe, expect, it } from "vitest";
import { applyEdits } from "./engine/edits";
import { echoAdapter, fixtureGroups, fixtureShot } from "./engine/test-fixtures";
import type { Edit } from "./engine/types";
import {
  addEdit,
  emptySession,
  lookText,
  pendingEdits,
  recordRenders,
  settle,
  shotViews,
  staleViews,
  type NewRender,
  type Session,
  type ShotView,
} from "./session";

const shots = [fixtureShot("s1", ["look/test", "bot/test"]), fixtureShot("s2", ["look/test", "bot/nope"])];
const toSodium: Edit = { path: "look/test.light", from: "grey light", to: "sodium light", at: "t1" };
const backToGrey: Edit = { path: "look/test.light", from: "sodium light", to: "grey light", at: "t2" };

const viewsFor = (session: Session) =>
  shotViews(applyEdits(fixtureGroups, session.log).groups, shots, echoAdapter, session);
const mock = (v: ShotView, at: string): NewRender => ({
  shotId: v.shot.id,
  key: v.key as string,
  entry: { kind: "mock", url: `mock:${v.key}`, prompt: "p", at },
});
const firstRender = (session: Session) => {
  const first = viewsFor(session).filter((v) => v.needsFirstRender).map((v) => mock(v, "t0"));
  return recordRenders(session, first, { apply: false, at: "t0" });
};

describe("shotViews", () => {
  it("marks a never-rendered shot for its first render, and a broken shot for none", () => {
    const [s1, s2] = viewsFor(emptySession());
    expect(s1).toMatchObject({ fresh: false, needsFirstRender: true, display: null });
    expect(s1.key).toMatch(/^[0-9a-f]{64}$/);
    expect(s2).toMatchObject({ key: null, needsFirstRender: false, display: null });
    expect(s2.composition).toEqual({ ok: false, unresolved: ["bot/nope"] });
  });

  it("goes stale after an edit and keeps showing the last render", () => {
    const rendered = firstRender(emptySession());
    const [before] = viewsFor(rendered);
    const [after] = viewsFor(addEdit(rendered, toSodium));
    expect(before.fresh).toBe(true);
    expect(after.fresh).toBe(false);
    expect(after.needsFirstRender).toBe(false);
    expect(after.display).toEqual(before.display);
    expect(staleViews(viewsFor(addEdit(rendered, toSodium))).map((v) => v.shot.id)).toEqual(["s1"]);
  });

  it("stays fresh when an edit touches a value the adapter did not read", () => {
    const rendered = firstRender(emptySession());
    const docEdit: Edit = { path: "bot/test.behaviour", from: "It falls over.", to: "It sits.", at: "t1" };
    const [after] = viewsFor(addEdit(rendered, docEdit));
    expect(after.key).toBe(rendered.shown.s1);
    expect(after.fresh).toBe(true);
  });
});

describe("recordRenders", () => {
  it("records before/after pairs and the edits an Apply covered", () => {
    const rendered = firstRender(emptySession());
    const beforeKey = rendered.shown.s1;
    const edited = addEdit(rendered, toSodium);
    const stale = staleViews(viewsFor(edited)).map((v) => mock(v, "t1"));
    const applied = recordRenders(edited, stale, { apply: true, at: "t1" });
    expect(applied.lastApply).toEqual({
      edits: [toSodium],
      pairs: [{ shotId: "s1", beforeKey, afterKey: stale[0].key }],
      at: "t1",
    });
    expect(applied.shown.s1).toBe(stale[0].key);
    expect(pendingEdits(applied)).toEqual([]);
    expect(viewsFor(applied)[0].fresh).toBe(true);
  });

  it("does not touch lastApply on a first render", () => {
    expect(firstRender(emptySession()).lastApply).toBeNull();
  });
});

describe("settle", () => {
  it("catches up after a rollback that needs no render", () => {
    const rendered = firstRender(emptySession());
    const edited = addEdit(rendered, toSodium);
    const applied = recordRenders(edited, staleViews(viewsFor(edited)).map((v) => mock(v, "t1")), {
      apply: true,
      at: "t1",
    });
    const rolledBack = addEdit(applied, backToGrey);
    const views = viewsFor(rolledBack);
    expect(views[0].fresh).toBe(true); // the grey render is still in the map
    const settled = settle(rolledBack, views);
    expect(settled.shown.s1).toBe(rendered.shown.s1);
    expect(pendingEdits(settled)).toEqual([]);
  });

  it("returns the same object when nothing changes", () => {
    const rendered = firstRender(emptySession());
    expect(settle(rendered, viewsFor(rendered))).toBe(rendered);
  });

  it("waits while any shot is stale", () => {
    const edited = addEdit(firstRender(emptySession()), toSodium);
    expect(settle(edited, viewsFor(edited))).toBe(edited);
  });
});

describe("lookText", () => {
  it("joins the shot's look values", () => {
    expect(lookText(shots[0], fixtureGroups)).toBe("grey light");
  });
});
