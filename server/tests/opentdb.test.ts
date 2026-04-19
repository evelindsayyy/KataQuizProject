// Targeted tests for the tricky bits: base64 decoding, response codes,
// token-exhausted retry, and category caching.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenTdbClient, OpenTdbError } from '../src/services/opentdb.js';

describe('OpenTdbClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const mockJson = (body: unknown) => ({
    ok: true,
    status: 200,
    json: async () => body,
  });

  it('decodes base64-encoded questions', async () => {
    const fetchMock = vi.mocked(fetch);
    // First call: token request
    fetchMock.mockResolvedValueOnce(mockJson({
      response_code: 0,
      token: 'abc123',
    }) as Response);
    // encode=base64 encodes every string field, including type/difficulty.
    fetchMock.mockResolvedValueOnce(mockJson({
      response_code: 0,
      results: [{
        category: Buffer.from('Science').toString('base64'),
        type: Buffer.from('multiple').toString('base64'),
        difficulty: Buffer.from('easy').toString('base64'),
        question: Buffer.from('What is 2+2?').toString('base64'),
        correct_answer: Buffer.from('4').toString('base64'),
        incorrect_answers: [
          Buffer.from('3').toString('base64'),
          Buffer.from('5').toString('base64'),
          Buffer.from('22').toString('base64'),
        ],
      }],
    }) as Response);

    const client = new OpenTdbClient();
    const [q] = await client.fetchQuestions({ amount: 1 });
    expect(q?.question).toBe('What is 2+2?');
    expect(q?.correctAnswer).toBe('4');
    expect(q?.incorrectAnswers).toEqual(['3', '5', '22']);
    expect(q?.difficulty).toBe('easy');
    expect(q?.type).toBe('multiple');
  });

  it('throws a typed error on response code 5 (rate limit)', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(mockJson({
      response_code: 0,
      token: 'abc',
    }) as Response);
    fetchMock.mockResolvedValueOnce(mockJson({
      response_code: 5,
      results: [],
    }) as Response);

    const client = new OpenTdbClient();
    await expect(client.fetchQuestions({ amount: 1 })).rejects.toBeInstanceOf(
      OpenTdbError,
    );
  });

  it('resets the token and retries once on response code 4 (token exhausted)', async () => {
    const fetchMock = vi.mocked(fetch);
    const b64 = (s: string) => Buffer.from(s).toString('base64');

    // token, exhausted-query, reset, retry-query
    fetchMock.mockResolvedValueOnce(mockJson({ response_code: 0, token: 'tok-1' }) as Response);
    fetchMock.mockResolvedValueOnce(mockJson({ response_code: 4, results: [] }) as Response);
    fetchMock.mockResolvedValueOnce(mockJson({ response_code: 0, token: 'tok-1' }) as Response);
    fetchMock.mockResolvedValueOnce(mockJson({
      response_code: 0,
      results: [{
        category: b64('History'),
        type: b64('multiple'),
        difficulty: b64('medium'),
        question: b64('When did WW2 end?'),
        correct_answer: b64('1945'),
        incorrect_answers: [b64('1944'), b64('1946'), b64('1939')],
      }],
    }) as Response);

    const client = new OpenTdbClient();
    const questions = await client.fetchQuestions({ amount: 1 });

    expect(questions).toHaveLength(1);
    expect(questions[0]?.correctAnswer).toBe('1945');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('caches categories across calls', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(mockJson({
      trivia_categories: [
        { id: 9, name: 'General Knowledge' },
        { id: 17, name: 'Science & Nature' },
      ],
    }) as Response);

    const client = new OpenTdbClient();
    const first = await client.fetchCategories();
    const second = await client.fetchCategories();

    // Second call hits the cache, not the network.
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
