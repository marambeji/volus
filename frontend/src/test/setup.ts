import '@testing-library/jest-dom/vitest';

// Required for @testing-library/react to synchronize with React's scheduler under Vitest.
// https://testing-library.com/docs/react-testing-library/api/#act
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
