// BudouX の文節の区切り（budoux@0.9.3 の dist/parser.js を TypeScript に写したもの）。
// Copyright 2021 Google LLC. Licensed under the Apache License, Version 2.0（同じフォルダの LICENSE）。
// https://github.com/google/budoux
// 変えた所（2026-10-17）：HTML を扱う部分（linkedom を使う html_processor）は写さず、文字列を区切る parse だけにした。
// 計算は元と同じ。辞書は model.ts。

type Model = Record<string, Record<string, number>>;

export class BudouxParser {
  private readonly model: Map<string, Map<string, number>>;
  private readonly baseScore: number;

  constructor(model: Model) {
    this.model = new Map(Object.entries(model).map(([key, value]) => [key, new Map(Object.entries(value))]));
    this.baseScore = -0.5 * [...this.model.values()]
      .flatMap((group) => [...group.values()])
      .reduce((prev, curr) => prev + curr, 0);
  }

  // 文を文節に分けて返す（つなげると元の文に戻る）。
  parse(sentence: string): string[] {
    if (sentence === '') return [];
    const result: string[] = [];
    let start = 0;
    for (const boundary of this.parseBoundaries(sentence)) {
      result.push(sentence.slice(start, boundary));
      start = boundary;
    }
    result.push(sentence.slice(start));
    return result;
  }

  private parseBoundaries(sentence: string): number[] {
    const result: number[] = [];
    const score = (key: string, text: string) => this.model.get(key)?.get(text) || 0;
    for (let i = 1; i < sentence.length; i++) {
      let total = this.baseScore;
      // 辞書の値は負のこともある
      total += score('UW1', sentence.substring(i - 3, i - 2));
      total += score('UW2', sentence.substring(i - 2, i - 1));
      total += score('UW3', sentence.substring(i - 1, i));
      total += score('UW4', sentence.substring(i, i + 1));
      total += score('UW5', sentence.substring(i + 1, i + 2));
      total += score('UW6', sentence.substring(i + 2, i + 3));
      total += score('BW1', sentence.substring(i - 2, i));
      total += score('BW2', sentence.substring(i - 1, i + 1));
      total += score('BW3', sentence.substring(i, i + 2));
      total += score('TW1', sentence.substring(i - 3, i));
      total += score('TW2', sentence.substring(i - 2, i + 1));
      total += score('TW3', sentence.substring(i - 1, i + 2));
      total += score('TW4', sentence.substring(i, i + 3));
      if (total > 0) result.push(i);
    }
    return result;
  }
}
