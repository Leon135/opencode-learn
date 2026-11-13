import { test, expect } from "bun:test"
import { homedir } from "node:os"
import { sanitizeDirInput } from "../plugins/paths.ts"

test("expands a leading ~ against the home directory", () => {
  const r = sanitizeDirInput("~/Notes/viz")
  expect(r.ok).toBe(true)
  if (r.ok) expect(r.value.startsWith(homedir())).toBe(true)
})

test("expands a bare ~ to the home directory", () => {
  const r = sanitizeDirInput("~")
  expect(r.ok).toBe(true)
  if (r.ok) expect(r.value).toBe(homedir())
})

test("rejects ~ with a .. segment", () => {
  expect(sanitizeDirInput("~/../x").ok).toBe(false)
})

test("passes absolute paths through", () => {
  const r = sanitizeDirInput("/abs/path")
  expect(r.ok).toBe(true)
  if (r.ok) expect(r.value).toBe("/abs/path")
})

test("passes relative paths through", () => {
  const r = sanitizeDirInput("rel/path")
  expect(r.ok).toBe(true)
  if (r.ok) expect(r.value).toBe("rel/path")
})

test("allows an empty value (callers decide the default)", () => {
  const r = sanitizeDirInput("")
  expect(r.ok).toBe(true)
  if (r.ok) expect(r.value).toBe("")
})

test("strips wrapping quotes before expanding ~", () => {
  const r = sanitizeDirInput('"~/notes"')
  expect(r.ok).toBe(true)
  if (r.ok) expect(r.value.startsWith(homedir())).toBe(true)
})

test("rejects NUL bytes", () => {
  expect(sanitizeDirInput("/a\0b").ok).toBe(false)
})

test("rejects .. segments", () => {
  expect(sanitizeDirInput("/a/../b").ok).toBe(false)
  expect(sanitizeDirInput("../x").ok).toBe(false)
})

test("rejects unsupported characters", () => {
  expect(sanitizeDirInput("a;b").ok).toBe(false)
  expect(sanitizeDirInput("a\\b").ok).toBe(false)
})
