import { describe, expect, it } from "vitest";

import { splitTextLinks } from "./text-links";

function links(input: string) {
  return splitTextLinks(input)
    .filter((part) => part.kind === "link")
    .map((part) => (part.kind === "link" ? part.href : ""));
}

describe("splitTextLinks", () => {
  it("turns a full web address into a link", () => {
    expect(splitTextLinks("https://www.linkedin.com/in/mustafakhalid03/")).toEqual([
      {
        kind: "link",
        text: "https://www.linkedin.com/in/mustafakhalid03/",
        href: "https://www.linkedin.com/in/mustafakhalid03/",
      },
    ]);
  });

  it("finds links inside a sentence and keeps the words around them", () => {
    expect(splitTextLinks("My work: https://example.com/portfolio, thanks")).toEqual([
      { kind: "text", text: "My work: " },
      {
        kind: "link",
        text: "https://example.com/portfolio",
        href: "https://example.com/portfolio",
      },
      { kind: "text", text: ", thanks" },
    ]);
  });

  it("adds https to addresses typed without it", () => {
    expect(links("linkedin.com/in/amara and www.github.com/amara")).toEqual([
      "https://linkedin.com/in/amara",
      "https://www.github.com/amara",
    ]);
  });

  it("leaves a closing bracket outside the link unless the link opened it", () => {
    expect(links("(see https://example.com/a)")).toEqual(["https://example.com/a"]);
    expect(links("https://en.wikipedia.org/wiki/Ads_(marketing)")).toEqual([
      "https://en.wikipedia.org/wiki/Ads_(marketing)",
    ]);
  });

  it("does not link plain words, numbers, or email addresses", () => {
    expect(links("250000")).toEqual([]);
    expect(links("I know Node.js and React")).toEqual([]);
    expect(links("i_can_join_immediately")).toEqual([]);
    expect(links("Reach me at amara@example.com/x")).toEqual([]);
  });

  it("never links anything that is not a web address", () => {
    expect(links("javascript:alert(1)")).toEqual([]);
    expect(links("ftp://example.com/file")).toEqual([]);
  });
});
