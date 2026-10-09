import { describe, expect, it } from 'vitest';
import { canTransitionDesignTask, getSafeDesignFileName, hasValidDesignFileSignature } from './design';

describe('design file handling', () => {
  it('accepts supported file signatures and rejects mismatched or unsupported files', () => {
    expect(hasValidDesignFileSignature('image/jpeg', Uint8Array.from([0xff, 0xd8, 0xff, 0x00]))).toBe(true);
    expect(hasValidDesignFileSignature('image/png', Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    expect(hasValidDesignFileSignature('application/pdf', Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe(true);
    expect(hasValidDesignFileSignature('image/png', Uint8Array.from([0xff, 0xd8, 0xff, 0x00]))).toBe(false);
    expect(hasValidDesignFileSignature('text/plain', Uint8Array.from([0x41, 0x42, 0x43]))).toBe(false);
  });

  describe('design task transitions', () => {
    it('allows only actions valid for the current workflow state', () => {
      expect(canTransitionDesignTask('NEW', 'start')).toBe(true);
      expect(canTransitionDesignTask('REVISION', 'start')).toBe(true);
      expect(canTransitionDesignTask('IN_PROGRESS', 'upload')).toBe(true);
      expect(canTransitionDesignTask('READY_FOR_REVIEW', 'approve')).toBe(true);
      expect(canTransitionDesignTask('READY_FOR_REVIEW', 'revision')).toBe(true);
      expect(canTransitionDesignTask('APPROVED', 'assign')).toBe(false);
      expect(canTransitionDesignTask('REVISION', 'upload')).toBe(false);
      expect(canTransitionDesignTask('APPROVED', 'start')).toBe(false);
    });
  });

  it('normalizes uploaded names to a bounded display-only filename', () => {
    expect(getSafeDesignFileName('..\\private\\final.png')).toBe('.._private_final.png');
    expect(getSafeDesignFileName('\u0000')).toBe('design-file');
    expect(getSafeDesignFileName('a'.repeat(200))).toHaveLength(180);
  });
});
