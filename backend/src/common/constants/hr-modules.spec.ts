import { HR_MODULES, FULL_HR_PERMISSIONS } from './hr-modules';

describe('hr-modules constants', () => {
  it('has one full-access entry per module', () => {
    expect(Object.keys(FULL_HR_PERMISSIONS).sort()).toEqual([...HR_MODULES].sort());
    for (const module of HR_MODULES) {
      expect(FULL_HR_PERMISSIONS[module]).toEqual({ canView: true, canManage: true });
    }
  });

  it('does not contain duplicate module keys', () => {
    expect(new Set(HR_MODULES).size).toBe(HR_MODULES.length);
  });
});
