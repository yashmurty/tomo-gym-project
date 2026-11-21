import { defineConfig } from 'orval';

export default defineConfig({
  frontend: {
    input: { target: './swagger.json' },
    output: {
      mode: 'tags-split',
      target: 'src/lib/generated/api.ts',
      schemas: 'src/lib/generated/models',
      client: 'fetch',
      mock: false,
      override: {
        mutator: {
          path: 'src/lib/api-client.ts',
          name: 'customFetch',
        },
        useDates: false,
      },
    },
  },
});
