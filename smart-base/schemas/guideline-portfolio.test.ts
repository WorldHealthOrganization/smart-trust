import { describe, expect, test } from "bun:test";
import { GuidelinePortfolioKind, GuidelinePortfolioSchema } from "./guideline-portfolio";

const level = (id: string) => ({ id, title: id, libraries: [] });
const portfolio = (ids: string[]) => ({
  $schema: "guideline-portfolio/1.0.0",
  id: "smart-guidelines",
  title: "SMART Guidelines",
  levels: ids.map(level),
});

describe("guideline-portfolio", () => {
  test("extendsPortfolioAndAcceptsSmartLevelsInOrder", () => {
    expect(GuidelinePortfolioKind.order).toEqual(["portfolio", "guideline-portfolio"]);
    expect(GuidelinePortfolioSchema.safeParse(portfolio(["L1", "L2", "L3"])).success).toBe(true);
    expect(GuidelinePortfolioSchema.safeParse(portfolio(["L1", "L3"])).success).toBe(true);
  });

  test("refusesUnknownOrOutOfOrderLevels", () => {
    expect(GuidelinePortfolioSchema.safeParse(portfolio(["L1", "L5"])).success).toBe(false);
    expect(GuidelinePortfolioSchema.safeParse(portfolio(["L2", "L1"])).success).toBe(false);
  });
});
