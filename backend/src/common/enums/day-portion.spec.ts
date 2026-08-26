import { DayPortion } from './index';

describe('DayPortion enum', () => {
  it('has exactly FULL_DAY, FIRST_HALF, SECOND_HALF', () => {
    expect(Object.values(DayPortion).sort()).toEqual(
      ['FIRST_HALF', 'FULL_DAY', 'SECOND_HALF'].sort(),
    );
  });
});
