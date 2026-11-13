import { test, expect } from "bun:test"
import { resolveSelected, type PendingQuiz } from "../plugins/quiz.ts"

const pq: PendingQuiz = {
  question: "capital?",
  mode: "chat",
  options: [
    { label: "Berlin", value: "berlin" },
    { label: "Paris", value: "paris" },
    { label: "Rome", value: "rome" },
  ],
  status: "asked",
  selectedIndices: [],
  dontKnow: false,
}

test("resolveSelected accepts option values", () => {
  expect(resolveSelected(pq, "berlin")).toEqual({ indices: [1], dontKnow: false })
})

test("resolveSelected accepts exact labels", () => {
  expect(resolveSelected(pq, "Paris")).toEqual({ indices: [2], dontKnow: false })
})

test("resolveSelected accepts labels case-insensitively", () => {
  expect(resolveSelected(pq, "paris")).toEqual({ indices: [2], dontKnow: false })
})

test("resolveSelected accepts bare letters", () => {
  expect(resolveSelected(pq, "B")).toEqual({ indices: [2], dontKnow: false })
  expect(resolveSelected(pq, "b")).toEqual({ indices: [2], dontKnow: false })
})

test("resolveSelected accepts letter + generated label", () => {
  expect(resolveSelected(pq, "B. Paris")).toEqual({ indices: [2], dontKnow: false })
})

test("resolveSelected accepts a letter-array input", () => {
  expect(resolveSelected(pq, ["A", "C"])).toEqual({ indices: [1, 3], dontKnow: false })
})

test("resolveSelected accepts the don't-know token", () => {
  expect(resolveSelected(pq, "__dont_know__")).toEqual({ indices: [], dontKnow: true })
  expect(resolveSelected(pq, "...?")).toEqual({ indices: [], dontKnow: true })
})

test("resolveSelected rejects unknown answers with an error", () => {
  const res = resolveSelected(pq, "madrid")
  expect("error" in res && res.error.length > 0).toBe(true)
})

test("resolveSelected rejects empty input with an error", () => {
  expect("error" in resolveSelected(pq, "")).toBe(true)
})

test("resolveSelected dedupes and sorts selections", () => {
  expect(resolveSelected(pq, ["C", "A", "C"])).toEqual({ indices: [1, 3], dontKnow: false })
})
