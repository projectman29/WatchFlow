export const DESIGN_STATUSES = ['NEW', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'REVISION', 'APPROVED'] as const;

export type DesignStatus = (typeof DESIGN_STATUSES)[number];
export type DesignTaskAction = 'assign' | 'start' | 'upload' | 'approve' | 'revision';

export const DESIGN_STATUS_LABELS: Record<DesignStatus, string> = {
  NEW: 'Новые',
  IN_PROGRESS: 'В работе',
  READY_FOR_REVIEW: 'На согласовании',
  REVISION: 'На доработке',
  APPROVED: 'Подтверждены',
};

export const DESIGN_FILE_TYPES = {
  'image/jpeg': { extension: '.jpg', signature: [0xff, 0xd8, 0xff] },
  'image/png': { extension: '.png', signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  'application/pdf': { extension: '.pdf', signature: [0x25, 0x50, 0x44, 0x46, 0x2d] },
} as const;

const ALLOWED_DESIGN_ACTION_STATUSES: Record<DesignTaskAction, readonly string[]> = {
  assign: ['NEW', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'REVISION'],
  start: ['NEW', 'REVISION'],
  upload: ['IN_PROGRESS'],
  approve: ['READY_FOR_REVIEW'],
  revision: ['READY_FOR_REVIEW'],
};

export function canTransitionDesignTask(status: string, action: DesignTaskAction): boolean {
  return ALLOWED_DESIGN_ACTION_STATUSES[action].includes(status);
}

export type DesignTaskRecord = {
  id: string;
  orderId: string;
  orderNumber: string;
  status: DesignStatus;
  client: string;
  model: string;
  engraving: string;
  notes: string;
  deadline?: string;
  revisionCount: number;
  designerId?: string;
  designerName?: string;
  canManage: boolean;
  files: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    size: number;
    version: number;
    createdAt: string;
  }>;
};

export function hasValidDesignFileSignature(mimeType: string, bytes: Uint8Array): boolean {
  const fileType = DESIGN_FILE_TYPES[mimeType as keyof typeof DESIGN_FILE_TYPES];
  return Boolean(
    fileType &&
    bytes.length >= fileType.signature.length &&
    fileType.signature.every((byte, index) => bytes[index] === byte),
  );
}

export function getSafeDesignFileName(fileName: string): string {
  return fileName
    .replace(/[\\/]/g, '_')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 180) || 'design-file';
}
