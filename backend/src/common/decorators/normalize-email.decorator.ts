import { Transform } from 'class-transformer';

// trims and lowercases an email before validation
// so Monkey@Test.com and monkey@test.com are the same account
export const NormalizeEmail = () =>
  Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );
