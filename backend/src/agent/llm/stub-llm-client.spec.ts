import { parseWorkout, StubLlmClient } from './stub-llm-client';

describe('StubLlmClient', () => {
  describe('parseWorkout', () => {
    it.each([
      ['2x10 @ 47kg lat pulldown', 'lat pulldown', 2, 'kg'],
      ['2*10@47kg lat pull down', 'lat pull down', 2, 'kg'],
      ['Pec fly machine 2 x 10 @ 40 kg', 'Pec fly machine', 2, 'kg'],
      ['Seated leg curl 2 x 10 @ 19lg', 'Seated leg curl', 2, 'kg'],
      ['3x5 @ 135 lb bench press', 'bench press', 3, 'lb'],
    ])('parses "%s"', (text, exercise, setCount, unit) => {
      const input = parseWorkout(text)!;
      expect(input.exercise).toBe(exercise);
      expect(input.unit).toBe(unit);
      expect(input.sets).toHaveLength(setCount);
      expect(input.date).toBe('today');
    });

    it('parses the brief cardio example', () => {
      expect(parseWorkout('10 min walk speed 6 incline 2')).toEqual({
        exercise: 'walk',
        date: 'today',
        durationMin: 10,
        speedKmh: 6,
        inclinePct: 2,
      });
    });

    it('returns null for anything else', () => {
      expect(parseWorkout('what did I lift last Tuesday?')).toBeNull();
    });
  });

  it('answers a workout with a log_entry tool_use, then confirms the result', async () => {
    const stub = new StubLlmClient();
    const base = { model: 'stub', system: '', tools: [], maxTokens: 100 };

    const first = await stub.createMessage({
      ...base,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: '<context>…</context>' },
            { type: 'text', text: '2x10 @ 47kg lat pulldown' },
          ],
        },
      ],
    });
    expect(first.stopReason).toBe('tool_use');
    expect(first.content[0]).toMatchObject({
      type: 'tool_use',
      name: 'log_entry',
    });

    const toolUse = first.content[0] as { id: string };
    const second = await stub.createMessage({
      ...base,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify({
                exercise: 'Lat pulldown',
                weightUnit: 'kg',
                sets: [
                  { reps: 10, weightKg: 47, weight: 47 },
                  { reps: 10, weightKg: 47, weight: 47 },
                ],
                date: '2026-11-20',
                dayNumber: 38,
              }),
            },
          ],
        },
      ],
    });
    expect(second.stopReason).toBe('end_turn');
    expect(second.content[0]).toEqual({
      type: 'text',
      text: 'Logged Lat pulldown: 2×10 @ 47 kg · 2026-11-20 · Day 38.',
    });
  });
});
