import { test, expect } from "bun:test"
import { mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  appendMessage,
  hasBlock,
  isSettled,
  pruneMirror,
  touchMirror,
} from "../plugins/md-link/core.ts"

const dir = join(tmpdir(), "md-link-core-test")
const file = join(dir, "test_link.md")

function fresh(): string {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  touchMirror(file)
  return file
}

function blocks(): string[] {
  return readFileSync(file, "utf-8").split(/(?=<!-- msg:)/g).filter((b) => b.trim().length > 0)
}

test("appendMessage writes a marked block", () => {
  fresh()
  expect(appendMessage(file, { text: "hello", markerKey: "m1" }, null)).toBe("written")
  expect(hasBlock(file, "m1")).toBe(true)
  expect(blocks()).toHaveLength(1)
  expect(readFileSync(file, "utf-8")).toContain("hello")
})

test("appendMessage same key without replace is a duplicate", () => {
  fresh()
  appendMessage(file, { text: "hello", markerKey: "m1" }, null)
  expect(appendMessage(file, { text: "hello", markerKey: "m1" }, null)).toBe("duplicate")
  expect(blocks()).toHaveLength(1)
})

test("appendMessage replace rewrites the block in place", () => {
  fresh()
  appendMessage(file, { text: "hello", markerKey: "m1" }, null)
  appendMessage(file, { text: "goodbye", markerKey: "m1", replace: true }, null)
  expect(appendMessage(file, { text: "goodbye", markerKey: "m1", replace: true }, null)).toBe("duplicate")
  const all = readFileSync(file, "utf-8")
  expect(blocks()).toHaveLength(1)
  expect(all).toContain("goodbye")
  expect(all).not.toContain("hello")
})

test("appendMessage replaces one key, keeps other blocks", () => {
  fresh()
  appendMessage(file, { text: "first", markerKey: "m1" }, null)
  appendMessage(file, { text: "second", markerKey: "m2" }, null)
  appendMessage(file, { text: "second v2", markerKey: "m2", replace: true }, null)
  const all = readFileSync(file, "utf-8")
  expect(blocks()).toHaveLength(2)
  expect(all).toContain("first")
  expect(all).toContain("second v2")
  expect(all).not.toContain("\nsecond\n")
})

test("pruneMirror keeps only the newest N blocks", () => {
  fresh()
  for (let i = 1; i <= 5; i++) appendMessage(file, { text: `msg${i}`, markerKey: `k${i}` }, null)
  pruneMirror(file, 2)
  const bs = blocks()
  expect(bs).toHaveLength(2)
  expect(readFileSync(file, "utf-8")).toContain("msg5")
  expect(readFileSync(file, "utf-8")).toContain("msg4")
  expect(readFileSync(file, "utf-8")).not.toContain("msg3")
})

test("pruneMirror is a no-op at exactly keep blocks", () => {
  fresh()
  for (let i = 1; i <= 3; i++) appendMessage(file, { text: `msg${i}`, markerKey: `k${i}` }, null)
  pruneMirror(file, 3)
  expect(blocks()).toHaveLength(3)
  expect(readFileSync(file, "utf-8")).toContain("msg1")
})

test("appendMessage prunes when keep is set", () => {
  fresh()
  for (let i = 1; i <= 3; i++) appendMessage(file, { text: `msg${i}`, markerKey: `k${i}` }, 2)
  expect(blocks()).toHaveLength(2)
  expect(readFileSync(file, "utf-8")).not.toContain("msg1")
})

test("isSettled: a reply is backfillable only once the provider finished it", () => {
  expect(isSettled({ type: "assistant", time: { created: 1 } })).toBe(false)
  expect(isSettled({ type: "assistant", time: { created: 1, completed: 2 } })).toBe(true)
  expect(isSettled({ type: "assistant" })).toBe(false)
  expect(isSettled({ type: "user", time: { created: 1 } })).toBe(true)
})

test("pruneMirror and appendMessage tolerate an empty file", () => {
  fresh()
  expect(appendMessage(file, { text: "x", markerKey: "k" }, 5)).toBe("written")
  pruneMirror(file, 5)
  expect(blocks()).toHaveLength(1)
})
